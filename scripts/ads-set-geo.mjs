/**
 * Retarget the search campaign to Oklahoma (from national/US).
 *
 * The search-terms report showed heavy out-of-state spend (San Diego, Austin,
 * Houston, FL...). NunezDev serves Oklahoma for web work, so we swap the
 * campaign's location criteria to the state of Oklahoma.
 *
 * Dry-run by default. Pass --commit to apply.
 *   node scripts/ads-set-geo.mjs            (dry-run)
 *   node scripts/ads-set-geo.mjs --commit
 *
 * Creds read from .env.local (never printed).
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi } from "google-ads-api";

const COMMIT = process.argv.includes("--commit");
const CAMPAIGN_NAME = "NunezDev - Search - US";

function loadEnv(path) {
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
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

const campRows = await customer.query(`
  SELECT campaign.id, campaign.name FROM campaign WHERE campaign.name = '${CAMPAIGN_NAME}'
`);
if (!campRows.length) {
  console.error(`Campaign not found: "${CAMPAIGN_NAME}"`);
  process.exit(1);
}
const campaignId = campRows[0].campaign.id;

// Resolve Oklahoma (US state) geo target constant by name.
const geoRows = await customer.query(`
  SELECT geo_target_constant.id, geo_target_constant.name,
         geo_target_constant.target_type, geo_target_constant.country_code
  FROM geo_target_constant
  WHERE geo_target_constant.name = 'Oklahoma'
    AND geo_target_constant.target_type = 'State'
    AND geo_target_constant.country_code = 'US'
    AND geo_target_constant.status = 'ENABLED'
`);
if (!geoRows.length) {
  console.error("Could not resolve the Oklahoma geo target constant.");
  process.exit(1);
}
const okId = geoRows[0].geo_target_constant.id;
console.log(`Oklahoma geo target constant: ${okId} (${geoRows[0].geo_target_constant.resource_name ?? "geoTargetConstants/" + okId})`);

// Current location criteria on the campaign.
const locRows = await customer.query(`
  SELECT campaign_criterion.resource_name, campaign_criterion.location.geo_target_constant,
         campaign_criterion.negative, campaign_criterion.type
  FROM campaign_criterion
  WHERE campaign.id = ${campaignId} AND campaign_criterion.type = 'LOCATION'
`);
const positive = locRows.filter((r) => !r.campaign_criterion?.negative);
console.log(`\nCampaign "${CAMPAIGN_NAME}" (id ${campaignId})`);
console.log(`Current LOCATION criteria: ${locRows.length}`);
for (const r of locRows) {
  console.log(`  - ${r.campaign_criterion.location?.geo_target_constant}${r.campaign_criterion.negative ? " (negative)" : ""}  [${r.campaign_criterion.resource_name}]`);
}

const alreadyOK =
  positive.length === 1 &&
  positive[0].campaign_criterion.location?.geo_target_constant?.endsWith(`/${okId}`);
if (alreadyOK) {
  console.log("\nAlready targeting only Oklahoma — nothing to do.");
  process.exit(0);
}

const toRemove = positive.map((r) => r.campaign_criterion.resource_name);
console.log(`\nPlan:`);
console.log(`  ADD    location -> Oklahoma (geoTargetConstants/${okId})`);
console.log(`  REMOVE ${toRemove.length} existing positive location criteria`);

if (!COMMIT) {
  console.log("\n[DRY-RUN] No changes written. Re-run with --commit to apply.");
  process.exit(0);
}

// Add Oklahoma first so the campaign is never momentarily location-less.
await customer.campaignCriteria.create([
  { campaign: `customers/${customerId}/campaigns/${campaignId}`, location: { geo_target_constant: `geoTargetConstants/${okId}` } },
]);
if (toRemove.length) await customer.campaignCriteria.remove(toRemove);
console.log(`\n✅ Campaign now targets Oklahoma; removed ${toRemove.length} prior location(s).`);
