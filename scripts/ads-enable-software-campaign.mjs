/**
 * Enable (un-pause) the software campaign so it starts serving.
 *
 * Reports the campaign status + the RSA's ad-review status, then (with
 * --commit) sets the campaign to ENABLED. Dry-run by default. Idempotent.
 *   node scripts/ads-enable-software-campaign.mjs            (dry-run)
 *   node scripts/ads-enable-software-campaign.mjs --commit
 *
 * Creds read from .env.local (never printed).
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums } from "google-ads-api";

const COMMIT = process.argv.includes("--commit");
const CAMPAIGN_NAME = "NunezDev - Search - Software - US";

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
const api = new GoogleAdsApi({
  client_id: env.GOOGLE_ADS_CLIENT_ID,
  client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
});
const customer = api.Customer({
  customer_id: digits(env.GOOGLE_ADS_CUSTOMER_ID),
  login_customer_id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) : undefined,
  refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
});

const rows = await customer.query(`
  SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status
  FROM campaign WHERE campaign.name = '${CAMPAIGN_NAME}'
`);
if (!rows.length) {
  console.error(`Campaign not found: "${CAMPAIGN_NAME}"`);
  process.exit(1);
}
const camp = rows[0].campaign;
console.log(`Campaign "${camp.name}" — current status ${camp.status} (2=ENABLED, 3=PAUSED)`);

// Ad review status — informational; the ad serves once approved.
const ads = await customer.query(`
  SELECT ad_group_ad.ad.id, ad_group_ad.policy_summary.approval_status,
         ad_group_ad.policy_summary.review_status
  FROM ad_group_ad WHERE campaign.id = ${camp.id}
`);
for (const a of ads) {
  console.log(`  Ad ${a.ad_group_ad.ad?.id}: approval=${a.ad_group_ad.policy_summary?.approval_status} review=${a.ad_group_ad.policy_summary?.review_status}`);
}

if (camp.status === enums.CampaignStatus.ENABLED) {
  console.log("\nAlready ENABLED — nothing to do.");
  process.exit(0);
}

console.log(`\nPlan: set campaign status → ENABLED`);
if (!COMMIT) {
  console.log("[DRY-RUN] No changes written. Re-run with --commit to apply.");
  process.exit(0);
}

await customer.campaigns.update([{ resource_name: camp.resource_name, status: enums.CampaignStatus.ENABLED }]);
console.log(`\n✅ Campaign "${CAMPAIGN_NAME}" is now ENABLED and will begin serving (pending ad review).`);
