/**
 * Add ad extensions (assets) to the two live search campaigns — the free,
 * safe "improve CTR" wins from Google's recommendations that don't cede any
 * control: sitelinks, callouts, and structured snippets.
 *
 * These are the only recommendations worth applying blindly; everything else
 * on the Recommendations tab either spends more money or hands bidding to
 * Google's automation. Extensions cost nothing and only ever help CTR.
 *
 * Dry-run by default (prints the plan, writes nothing). Pass --commit to apply.
 *   node scripts/ads-add-extensions.mjs            (dry-run)
 *   node scripts/ads-add-extensions.mjs --commit
 *
 * Idempotent: existing links are detected by signature (sitelink link text,
 * callout text, snippet header) and skipped, so re-running is safe. Copy is
 * tailored per campaign — the website campaign points at nunezdev.com pages,
 * the software campaign at /custom-software. Creds read from .env.local.
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums } from "google-ads-api";

const COMMIT = process.argv.includes("--commit");
const BASE = "https://www.nunezdev.com";

// Per-campaign extension copy. Google's limits, enforced below:
//   sitelink link_text <= 25, description1/2 <= 35
//   callout_text <= 25
//   structured snippet values <= 25 (header must be a Google-predefined label)
const PLAN = {
  "NunezDev - Search - US": {
    sitelinks: [
      { link_text: "Our Work", url: `${BASE}/portfolio`, description1: "See real client sites", description2: "Custom-built, no templates" },
      { link_text: "Pricing", url: `${BASE}/pricing`, description1: "Clear project pricing", description2: "Websites to custom CRMs" },
      { link_text: "Services", url: `${BASE}/services`, description1: "Web design & software", description2: "Built for your business" },
      { link_text: "Contact Us", url: `${BASE}/contact`, description1: "Free consultation", description2: "Talk to a real developer" },
    ],
    callouts: ["Free Consultation", "No Templates", "U.S.-Based Developer", "Local to Oklahoma", "Custom-Built Sites", "Fast Turnaround"],
    snippet: { header: "Services", values: ["Web Design", "Custom CRM Software", "Business Automation", "QuickBooks Integrations", "Hosting & SEO"] },
  },
  "NunezDev - Search - Software - US": {
    sitelinks: [
      { link_text: "Custom CRM Dev", url: `${BASE}/custom-software`, description1: "Replace your spreadsheets", description2: "Built around how you work" },
      { link_text: "See Our Work", url: `${BASE}/portfolio`, description1: "Real custom software", description2: "Built for real businesses" },
      { link_text: "Pricing Plans", url: `${BASE}/pricing`, description1: "From $10k or $500/mo", description2: "Project or partner plans" },
      { link_text: "Book a Call", url: `${BASE}/contact`, description1: "Free discovery call", description2: "Talk to the developer" },
    ],
    callouts: ["From $10k or $500/mo", "No Offshore Teams", "QuickBooks Integrations", "Free Discovery Call", "One U.S. Developer", "Built Around You"],
    snippet: { header: "Services", values: ["Custom CRM", "Workflow Automation", "Web Applications", "Software Integrations", "Project Management"] },
  },
};

// --- validate copy limits up front (fail loud, not at the API) ---
for (const [camp, p] of Object.entries(PLAN)) {
  for (const s of p.sitelinks) {
    if (s.link_text.length > 25) throw new Error(`[${camp}] sitelink link_text >25: "${s.link_text}"`);
    if (s.description1.length > 35) throw new Error(`[${camp}] sitelink description1 >35: "${s.description1}"`);
    if (s.description2.length > 35) throw new Error(`[${camp}] sitelink description2 >35: "${s.description2}"`);
  }
  for (const c of p.callouts) if (c.length > 25) throw new Error(`[${camp}] callout >25: "${c}"`);
  for (const v of p.snippet.values) if (v.length > 25) throw new Error(`[${camp}] snippet value >25: "${v}"`);
  if (p.snippet.values.length < 3) throw new Error(`[${camp}] structured snippet needs >=3 values`);
}

function loadEnv(path) {
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[line.slice(0, eq).trim()] = val;
  }
  return out;
}

const env = loadEnv(".env.local");
const digits = (s) => (s ?? "").replace(/[^0-9]/g, "");
const customerId = digits(env.GOOGLE_ADS_CUSTOMER_ID);

const api = new GoogleAdsApi({
  client_id: env.GOOGLE_ADS_CLIENT_ID,
  client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
});
const customer = api.Customer({
  customer_id: customerId,
  login_customer_id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) : undefined,
  refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
});

// Resolve campaign ids by name (only the ones present in the account).
const names = Object.keys(PLAN);
const campRows = await customer.query(`
  SELECT campaign.id, campaign.name, campaign.status
  FROM campaign
  WHERE campaign.name IN (${names.map((n) => `'${n}'`).join(",")})
    AND campaign.status != 'REMOVED'
`);
const campByName = new Map(campRows.map((r) => [r.campaign.name, r.campaign.id]));
for (const n of names) if (!campByName.has(n)) console.warn(`! Campaign not found, skipping: "${n}"`);

// Pull existing linked extension assets so we never create duplicates. We key
// on a human-readable signature per field type.
const linkRows = await customer.query(`
  SELECT campaign.id, campaign_asset.field_type,
         asset.sitelink_asset.link_text,
         asset.callout_asset.callout_text,
         asset.structured_snippet_asset.header
  FROM campaign_asset
  WHERE campaign.id IN (${[...campByName.values()].join(",") || "0"})
    AND campaign_asset.status != 'REMOVED'
`);
const existing = new Set(); // `${campaignId}|${fieldType}|${signature}`
for (const r of linkRows) {
  const ft = r.campaign_asset?.field_type;
  const sig =
    r.asset?.sitelink_asset?.link_text ||
    r.asset?.callout_asset?.callout_text ||
    r.asset?.structured_snippet_asset?.header ||
    "";
  existing.add(`${r.campaign.id}|${ft}|${sig.toLowerCase()}`);
}

const has = (campId, ft, sig) => existing.has(`${campId}|${ft}|${sig.toLowerCase()}`);

// Build the create plan: one asset + one campaign_asset link per missing item.
// Snippet is one asset per campaign (keyed on header).
const toCreate = []; // { campName, campId, fieldType, label, assetSpec, signature }
for (const [campName, p] of Object.entries(PLAN)) {
  const campId = campByName.get(campName);
  if (!campId) continue;

  for (const s of p.sitelinks) {
    if (has(campId, enums.AssetFieldType.SITELINK, s.link_text)) continue;
    toCreate.push({
      campName, campId, fieldType: enums.AssetFieldType.SITELINK,
      label: `sitelink "${s.link_text}" -> ${s.url}`,
      assetSpec: { final_urls: [s.url], sitelink_asset: { link_text: s.link_text, description1: s.description1, description2: s.description2 } },
    });
  }
  for (const text of p.callouts) {
    if (has(campId, enums.AssetFieldType.CALLOUT, text)) continue;
    toCreate.push({
      campName, campId, fieldType: enums.AssetFieldType.CALLOUT,
      label: `callout "${text}"`,
      assetSpec: { callout_asset: { callout_text: text } },
    });
  }
  if (!has(campId, enums.AssetFieldType.STRUCTURED_SNIPPET, p.snippet.header)) {
    toCreate.push({
      campName, campId, fieldType: enums.AssetFieldType.STRUCTURED_SNIPPET,
      label: `structured snippet "${p.snippet.header}": ${p.snippet.values.join(", ")}`,
      assetSpec: { structured_snippet_asset: { header: p.snippet.header, values: p.snippet.values } },
    });
  }
}

console.log(`\nCampaigns: ${[...campByName.keys()].map((n) => `"${n}"`).join(", ")}`);
console.log(`Existing extension links found: ${existing.size}`);
console.log(`Will CREATE ${toCreate.length} extension(s):`);
for (const t of toCreate) console.log(`  + [${t.campName}] ${t.label}`);
if (toCreate.length === 0) console.log("  (nothing — everything already linked)");

if (!COMMIT) {
  console.log("\n[DRY-RUN] No changes written. Re-run with --commit to apply.");
  process.exit(0);
}
if (toCreate.length === 0) process.exit(0);

// 1. create the assets, 2. link each to its campaign. Assets are reusable and
// harmless if a later link fails, so we don't bother with a rollback.
const assetRes = await customer.assets.create(toCreate.map((t) => t.assetSpec));
const assetNames = assetRes.results.map((r) => r.resource_name);

await customer.campaignAssets.create(
  toCreate.map((t, i) => ({
    campaign: `customers/${customerId}/campaigns/${t.campId}`,
    asset: assetNames[i],
    field_type: t.fieldType,
  })),
);

console.log(`\n✅ Created and linked ${toCreate.length} extension(s) across ${campByName.size} campaign(s).`);
console.log("   Google will start showing them once they pass review (usually < 1 day).");
