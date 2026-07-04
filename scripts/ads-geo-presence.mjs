/**
 * Stop paying for out-of-market clicks: switch every enabled Search campaign to
 * PRESENCE-only location targeting and exclude high-spam countries.
 *
 * Two independent fixes, both applied per campaign:
 *   1. geo_target_type_setting.positive_geo_target_type -> PRESENCE
 *      (Google's default is PRESENCE_OR_INTEREST, which shows Oklahoma-targeted
 *      ads to people *physically abroad* who merely searched something local —
 *      that's how the India app-clone / AEPS-UPI leads were finding us.)
 *   2. Add each EXCLUDE_COUNTRIES entry as a negative LOCATION criterion.
 *
 * Only ENABLED SEARCH campaigns are touched — geo_target_type_setting doesn't
 * apply cleanly to Performance Max, and those are skipped + logged (never
 * silently). Idempotent: a campaign already on PRESENCE / already excluding a
 * country is left alone.
 *
 * Dry-run by default. Pass --commit to apply.
 *   node scripts/ads-geo-presence.mjs            (dry-run)
 *   node scripts/ads-geo-presence.mjs --commit
 *
 * Creds read from .env.local (never printed).
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums } from "google-ads-api";

const COMMIT = process.argv.includes("--commit");

// Countries to exclude everywhere. Add more names here if new spam origins show
// up in the search-terms / locations report.
const EXCLUDE_COUNTRIES = ["India"];

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

// Resolve each exclude country to its country-level geo target constant.
const excludeConstants = [];
for (const name of EXCLUDE_COUNTRIES) {
  const rows = await customer.query(`
    SELECT geo_target_constant.id, geo_target_constant.name, geo_target_constant.country_code
    FROM geo_target_constant
    WHERE geo_target_constant.name = '${name.replace(/'/g, "\\'")}'
      AND geo_target_constant.target_type = 'Country'
      AND geo_target_constant.status = 'ENABLED'
  `);
  if (!rows.length) {
    console.error(`Could not resolve country geo target constant for "${name}" — aborting.`);
    process.exit(1);
  }
  const id = rows[0].geo_target_constant.id;
  excludeConstants.push({ name, resourceName: `geoTargetConstants/${id}` });
  console.log(`Exclude "${name}" -> geoTargetConstants/${id}`);
}

// All enabled campaigns + their current positive geo target type.
const campRows = await customer.query(`
  SELECT campaign.id, campaign.name, campaign.resource_name,
         campaign.advertising_channel_type,
         campaign.geo_target_type_setting.positive_geo_target_type
  FROM campaign
  WHERE campaign.status = 'ENABLED'
  ORDER BY campaign.name
`);

// Existing negative LOCATION criteria across enabled campaigns, grouped by campaign id.
const negLocRows = await customer.query(`
  SELECT campaign.id, campaign_criterion.location.geo_target_constant
  FROM campaign_criterion
  WHERE campaign.status = 'ENABLED'
    AND campaign_criterion.type = 'LOCATION'
    AND campaign_criterion.negative = true
`);
const existingExcludes = new Map(); // campaignId -> Set(geoTargetConstant resource names)
for (const r of negLocRows) {
  const id = String(r.campaign.id);
  const gtc = r.campaign_criterion.location?.geo_target_constant;
  if (!existingExcludes.has(id)) existingExcludes.set(id, new Set());
  if (gtc) existingExcludes.get(id).add(gtc);
}

const campaignUpdates = [];
const criteriaCreates = [];
const skipped = [];

for (const row of campRows) {
  const c = row.campaign;
  const id = String(c.id);
  if (c.advertising_channel_type !== enums.AdvertisingChannelType.SEARCH) {
    skipped.push(`${c.name} (${enums.AdvertisingChannelType[c.advertising_channel_type]})`);
    continue;
  }

  console.log(`\nCampaign "${c.name}" (id ${id})`);

  // 1. Presence targeting.
  const current = c.geo_target_type_setting?.positive_geo_target_type;
  if (current === enums.PositiveGeoTargetType.PRESENCE) {
    console.log("  positive geo target type: already PRESENCE");
  } else {
    console.log(`  positive geo target type: ${enums.PositiveGeoTargetType[current] ?? current} -> PRESENCE`);
    campaignUpdates.push({
      resource_name: c.resource_name,
      geo_target_type_setting: {
        positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
        // Negative side stays on PRESENCE so an exclusion means "physically
        // there" — the correct pairing for a hard country block.
        negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
      },
    });
  }

  // 2. Country exclusions.
  const have = existingExcludes.get(id) ?? new Set();
  for (const ex of excludeConstants) {
    if (have.has(ex.resourceName)) {
      console.log(`  exclude ${ex.name}: already excluded`);
    } else {
      console.log(`  exclude ${ex.name}: ADD`);
      criteriaCreates.push({
        campaign: `customers/${customerId}/campaigns/${id}`,
        negative: true,
        location: { geo_target_constant: ex.resourceName },
      });
    }
  }
}

if (skipped.length) {
  console.log(`\nSkipped ${skipped.length} non-Search campaign(s) (geo type setting N/A):`);
  for (const s of skipped) console.log(`  - ${s}`);
}

console.log(`\nPlan: ${campaignUpdates.length} campaign geo-type update(s), ${criteriaCreates.length} exclusion(s) to add.`);
if (!campaignUpdates.length && !criteriaCreates.length) {
  console.log("Nothing to do — all enabled Search campaigns already correct.");
  process.exit(0);
}

if (!COMMIT) {
  console.log("\n[DRY-RUN] No changes written. Re-run with --commit to apply.");
  process.exit(0);
}

if (campaignUpdates.length) await customer.campaigns.update(campaignUpdates);
if (criteriaCreates.length) await customer.campaignCriteria.create(criteriaCreates);
console.log(`\n✅ Applied ${campaignUpdates.length} geo-type update(s) and ${criteriaCreates.length} exclusion(s).`);
