/**
 * Create the national custom-software / CRM search campaign, and rebalance the
 * budget split (website ~$300/mo Oklahoma + software ~$200/mo US).
 *
 * The software campaign is created PAUSED — even after --commit it spends
 * nothing until you review it in the Ads UI and enable it. Ads point at the
 * live /custom-software landing page.
 *
 * Dry-run by default. Pass --commit to apply.
 *   node scripts/ads-create-software-campaign.mjs            (dry-run)
 *   node scripts/ads-create-software-campaign.mjs --commit
 *
 * Idempotent-ish: if a campaign named SOFTWARE_CAMPAIGN already exists it will
 * not be recreated. Creds read from .env.local (never printed).
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums } from "google-ads-api";

const COMMIT = process.argv.includes("--commit");

const WEBSITE_CAMPAIGN = "NunezDev - Search - US"; // now Oklahoma-targeted
const SOFTWARE_CAMPAIGN = "NunezDev - Search - Software - US";
const LANDING_URL = "https://www.nunezdev.com/custom-software";

// Average daily budgets (Google bills monthly ≈ daily × 30.4).
const WEBSITE_DAILY_MICROS = 9_870_000; // ~$300/mo
const SOFTWARE_DAILY_MICROS = 6_580_000; // ~$200/mo
const AD_GROUP_CPC_MICROS = 3_000_000; // $3.00 starting max CPC (manual, adjust later)

const US_GEO = "geoTargetConstants/2840";
const EN_LANG = "languageConstants/1000";

const KEYWORDS = [
  "custom crm development",
  "custom crm software",
  "build a custom crm",
  "custom software development",
  "custom business software",
  "custom project management software",
  "workflow automation software",
  "custom web application development",
  "custom software developer",
];

// Software-specific negatives (on top of intent — these buyers aren't shopping
// free/open-source tools, jobs, or courses).
const NEGATIVES = [
  "free", "cheap", "jobs", "salary", "course", "tutorial",
  "template", "open source", "download", "intern", "certification", "how to",
];

// RSA assets. Headlines ≤30 chars, descriptions ≤90 — validated below.
const HEADLINES = [
  "Custom CRM Development",
  "Software Built Around You",
  "Ditch the Spreadsheets",
  "Custom-Built, Not Templated",
  "Custom Software From $10k",
  "$500/mo Partner Plan",
  "U.S. Developer, No Offshore",
  "QuickBooks Integrations",
  "Free Discovery Call",
  "Built Around How You Work",
  "One Developer, Start to End",
];
const DESCRIPTIONS = [
  "Custom CRMs, project & workflow tools built around how your business runs.",
  "Replace clunky spreadsheets with software made for you. From $10k or $500/mo.",
  "Full construction-management platform built for a Utah builder. Yours is next.",
  "Hand-coded by one U.S. developer, no templates, no offshore. Book a free call.",
];
const PATH1 = "custom-software";
const PATH2 = "crm";

// --- validate asset limits up front (fail loud, not at the API) ---
for (const h of HEADLINES) if (h.length > 30) throw new Error(`Headline >30: "${h}" (${h.length})`);
for (const d of DESCRIPTIONS) if (d.length > 90) throw new Error(`Description >90: "${d}" (${d.length})`);
if (HEADLINES.length < 3 || DESCRIPTIONS.length < 2) throw new Error("RSA needs >=3 headlines, >=2 descriptions");

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

// --- read current campaigns + budgets ---
const rows = await customer.query(`
  SELECT campaign.id, campaign.name, campaign.status,
         campaign_budget.resource_name, campaign_budget.amount_micros,
         campaign_budget.explicitly_shared, campaign_budget.reference_count
  FROM campaign
  WHERE campaign.status != 'REMOVED'
`);

console.log("Current campaigns:");
for (const r of rows) {
  console.log(`  · ${r.campaign.name} — budget ${D(r.campaign_budget.amount_micros)}/day` +
    ` (shared: ${r.campaign_budget.explicitly_shared}, refs: ${r.campaign_budget.reference_count})`);
}

const website = rows.find((r) => r.campaign.name === WEBSITE_CAMPAIGN);
const existingSoftware = rows.find((r) => r.campaign.name === SOFTWARE_CAMPAIGN);

console.log("\nPlan:");
// 1. website budget → ~$300/mo (only if safe to touch)
let websiteBudgetChange = null;
if (website) {
  const shared = website.campaign_budget.explicitly_shared || website.campaign_budget.reference_count > 1;
  if (shared) {
    console.log(`  ! Website budget is shared (refs ${website.campaign_budget.reference_count}) — NOT changing it automatically.`);
  } else if (website.campaign_budget.amount_micros === WEBSITE_DAILY_MICROS) {
    console.log(`  = Website budget already ${D(WEBSITE_DAILY_MICROS)}/day (~$300/mo) — no change.`);
  } else {
    websiteBudgetChange = website.campaign_budget.resource_name;
    console.log(`  ~ Website budget ${D(website.campaign_budget.amount_micros)} -> ${D(WEBSITE_DAILY_MICROS)}/day (~$300/mo)`);
  }
}
// 2. software campaign
if (existingSoftware) {
  console.log(`  = Software campaign "${SOFTWARE_CAMPAIGN}" already exists — skipping creation.`);
} else {
  console.log(`  + Create budget ${D(SOFTWARE_DAILY_MICROS)}/day (~$200/mo)`);
  console.log(`  + Create campaign "${SOFTWARE_CAMPAIGN}" — SEARCH, PAUSED, Manual CPC, Google search only, US + English`);
  console.log(`  + Ad group "Custom Software" @ ${D(AD_GROUP_CPC_MICROS)} max CPC`);
  console.log(`  + ${KEYWORDS.length} phrase keywords: ${KEYWORDS.join(", ")}`);
  console.log(`  + ${NEGATIVES.length} negatives: ${NEGATIVES.join(", ")}`);
  console.log(`  + 1 responsive search ad (${HEADLINES.length} headlines, ${DESCRIPTIONS.length} descriptions) -> ${LANDING_URL}`);
}

if (!COMMIT) {
  console.log("\n[DRY-RUN] No changes written. Re-run with --commit to apply.");
  process.exit(0);
}

// ---------------- COMMIT ----------------
if (websiteBudgetChange) {
  await customer.campaignBudgets.update([{ resource_name: websiteBudgetChange, amount_micros: WEBSITE_DAILY_MICROS }]);
  console.log(`\n✅ Website budget set to ${D(WEBSITE_DAILY_MICROS)}/day.`);
}

if (existingSoftware) {
  console.log("Software campaign already exists — nothing further to create.");
  process.exit(0);
}

// 1. budget — reuse if a prior (failed) run already created it, so we don't
// leave orphaned budgets behind or hit a duplicate-name error.
const BUDGET_NAME = `${SOFTWARE_CAMPAIGN} (budget)`;
let budgetResourceName;
const priorBudget = await customer.query(`
  SELECT campaign_budget.resource_name FROM campaign_budget
  WHERE campaign_budget.name = '${BUDGET_NAME}' AND campaign_budget.status != 'REMOVED'
`);
if (priorBudget.length) {
  budgetResourceName = priorBudget[0].campaign_budget.resource_name;
  console.log("Reusing existing software budget from a prior run.");
} else {
  const budgetRes = await customer.campaignBudgets.create([{
    name: BUDGET_NAME,
    amount_micros: SOFTWARE_DAILY_MICROS,
    delivery_method: enums.BudgetDeliveryMethod.STANDARD,
    explicitly_shared: false,
  }]);
  budgetResourceName = budgetRes.results[0].resource_name;
}

// 2. campaign (PAUSED, manual CPC, search-only)
const campRes = await customer.campaigns.create([{
  name: SOFTWARE_CAMPAIGN,
  status: enums.CampaignStatus.PAUSED,
  advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
  // Required by Google Ads API v17+ on campaign creation.
  contains_eu_political_advertising:
    enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING,
  manual_cpc: { enhanced_cpc_enabled: false },
  campaign_budget: budgetResourceName,
  network_settings: {
    target_google_search: true,
    target_search_network: false,
    target_content_network: false,
    target_partner_search_network: false,
  },
}]);
const campaignResourceName = campRes.results[0].resource_name;

// 3. geo + language + negatives
await customer.campaignCriteria.create([
  { campaign: campaignResourceName, location: { geo_target_constant: US_GEO } },
  { campaign: campaignResourceName, language: { language_constant: EN_LANG } },
  ...NEGATIVES.map((text) => ({
    campaign: campaignResourceName,
    negative: true,
    keyword: { text, match_type: enums.KeywordMatchType.PHRASE },
  })),
]);

// 4. ad group
const agRes = await customer.adGroups.create([{
  name: "Custom Software",
  campaign: campaignResourceName,
  status: enums.AdGroupStatus.ENABLED,
  type: enums.AdGroupType.SEARCH_STANDARD,
  cpc_bid_micros: AD_GROUP_CPC_MICROS,
}]);
const adGroupResourceName = agRes.results[0].resource_name;

// 5. keywords
await customer.adGroupCriteria.create(
  KEYWORDS.map((text) => ({
    ad_group: adGroupResourceName,
    status: enums.AdGroupCriterionStatus.ENABLED,
    keyword: { text, match_type: enums.KeywordMatchType.PHRASE },
  })),
);

// 6. responsive search ad
await customer.adGroupAds.create([{
  ad_group: adGroupResourceName,
  status: enums.AdGroupAdStatus.ENABLED,
  ad: {
    final_urls: [LANDING_URL],
    responsive_search_ad: {
      headlines: HEADLINES.map((text) => ({ text })),
      descriptions: DESCRIPTIONS.map((text) => ({ text })),
      path1: PATH1,
      path2: PATH2,
    },
  },
}]);

console.log(`\n✅ Created PAUSED campaign "${SOFTWARE_CAMPAIGN}" with budget, US+English targeting,`);
console.log(`   ${KEYWORDS.length} keywords, ${NEGATIVES.length} negatives, and 1 RSA -> ${LANDING_URL}`);
console.log(`   Review it in the Ads UI, then ENABLE it when you're ready to spend.`);
