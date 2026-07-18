/**
 * "Lean software trial" — the keep-or-kill decision (2026-07-17). Google Ads
 * spent ~$689 in 6 weeks for $0 collected revenue, so we stop the money pit and
 * give ONLY the strategic (software/CRM) campaign a small, defined trial:
 *
 *   1. PAUSE the website campaign  "NunezDev - Search - US"  (was $128/lead, junk)
 *   2. Trim the software campaign  "NunezDev - Search - Software - US"  to ~$150/mo
 *   3. Add spam negatives to the software campaign so the India app-clone junk
 *      (aeps/upi/recharge/youtube-clone) that inflated its numbers stops.
 *
 * Re-evaluate ~2026-09-01: keep only if it produced a real PAYING software lead.
 * Everything here is reversible (un-pause, raise budget, remove negatives).
 *
 * Dry-run by default. Pass --commit to apply.
 *   node scripts/ads-lean-trial.mjs            (dry-run)
 *   node scripts/ads-lean-trial.mjs --commit
 *
 * Idempotent: a paused campaign stays paused, an already-$150 budget is left
 * alone, existing negatives are skipped. Creds read from .env.local.
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums } from "google-ads-api";

const COMMIT = process.argv.includes("--commit");

const WEBSITE_CAMPAIGN = "NunezDev - Search - US";
const SOFTWARE_CAMPAIGN = "NunezDev - Search - Software - US";
const SOFTWARE_DAILY_MICROS = 4_930_000; // ~$150/mo (daily × 30.4), was ~$200/mo
const NEW_NEGATIVES = ["clone", "aeps", "upi", "recharge", "youtube"];

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
const D = (m) => `$${(m / 1e6).toFixed(2)}`;

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

// Current state of both campaigns + their budgets.
const rows = await customer.query(`
  SELECT campaign.id, campaign.name, campaign.status, campaign.resource_name,
         campaign_budget.resource_name, campaign_budget.amount_micros,
         campaign_budget.explicitly_shared, campaign_budget.reference_count
  FROM campaign
  WHERE campaign.name IN ('${WEBSITE_CAMPAIGN}', '${SOFTWARE_CAMPAIGN}')
    AND campaign.status != 'REMOVED'
`);
const website = rows.find((r) => r.campaign.name === WEBSITE_CAMPAIGN);
const software = rows.find((r) => r.campaign.name === SOFTWARE_CAMPAIGN);

console.log("Plan:");

// 1. pause website
let pauseWebsite = false;
if (!website) {
  console.log(`  ! Website campaign "${WEBSITE_CAMPAIGN}" not found — skipping pause.`);
} else if (website.campaign.status === enums.CampaignStatus.PAUSED) {
  console.log(`  = Website "${WEBSITE_CAMPAIGN}" already PAUSED — no change.`);
} else {
  pauseWebsite = true;
  console.log(`  ~ PAUSE website "${WEBSITE_CAMPAIGN}" (was status ${website.campaign.status}).`);
}

// 2. trim software budget (guard against touching a shared budget)
let budgetChange = null;
if (!software) {
  console.log(`  ! Software campaign "${SOFTWARE_CAMPAIGN}" not found — skipping budget + negatives.`);
} else {
  const b = software.campaign_budget;
  const shared = b.explicitly_shared || b.reference_count > 1;
  if (shared) {
    console.log(`  ! Software budget is shared (refs ${b.reference_count}) — NOT changing it automatically.`);
  } else if (b.amount_micros === SOFTWARE_DAILY_MICROS) {
    console.log(`  = Software budget already ${D(SOFTWARE_DAILY_MICROS)}/day (~$150/mo) — no change.`);
  } else {
    budgetChange = b.resource_name;
    console.log(`  ~ Software budget ${D(b.amount_micros)} -> ${D(SOFTWARE_DAILY_MICROS)}/day (~$150/mo).`);
  }
}

// 3. add negatives to software campaign (skip existing)
let toAddNegatives = [];
if (software) {
  const existingRows = await customer.query(`
    SELECT campaign_criterion.keyword.text
    FROM campaign_criterion
    WHERE campaign.id = ${software.campaign.id}
      AND campaign_criterion.negative = true
      AND campaign_criterion.type = 'KEYWORD'
  `);
  const existing = new Set(existingRows.map((r) => (r.campaign_criterion?.keyword?.text ?? "").toLowerCase()));
  toAddNegatives = NEW_NEGATIVES.filter((n) => !existing.has(n.toLowerCase()));
  const skipped = NEW_NEGATIVES.filter((n) => existing.has(n.toLowerCase()));
  console.log(`  + Add ${toAddNegatives.length} software negatives: ${toAddNegatives.join(", ") || "(none)"}`);
  if (skipped.length) console.log(`    (skipping already-present: ${skipped.join(", ")})`);
}

if (!COMMIT) {
  console.log("\n[DRY-RUN] No changes written. Re-run with --commit to apply.");
  process.exit(0);
}

// ---------------- COMMIT ----------------
if (pauseWebsite) {
  await customer.campaigns.update([{ resource_name: website.campaign.resource_name, status: enums.CampaignStatus.PAUSED }]);
  console.log(`✅ Paused "${WEBSITE_CAMPAIGN}".`);
}
if (budgetChange) {
  await customer.campaignBudgets.update([{ resource_name: budgetChange, amount_micros: SOFTWARE_DAILY_MICROS }]);
  console.log(`✅ Software budget set to ${D(SOFTWARE_DAILY_MICROS)}/day (~$150/mo).`);
}
if (toAddNegatives.length) {
  await customer.campaignCriteria.create(
    toAddNegatives.map((text) => ({
      campaign: software.campaign.resource_name,
      negative: true,
      keyword: { text, match_type: enums.KeywordMatchType.PHRASE },
    })),
  );
  console.log(`✅ Added ${toAddNegatives.length} negatives to "${SOFTWARE_CAMPAIGN}".`);
}
console.log("\nDone. Re-evaluate ~2026-09-01 — keep only if it produced a real paying software lead.");
