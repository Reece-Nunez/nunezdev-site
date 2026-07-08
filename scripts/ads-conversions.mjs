/**
 * READ-ONLY: break down conversions by action name / date / keyword for the
 * last 30 days, so a headline "conversions value" can be traced to the actual
 * events (and their ASSIGNED value) rather than taken at face value.
 *
 * Run:  node scripts/ads-conversions.mjs
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi } from "google-ads-api";

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
const d2 = (n) => Number(n.toFixed(2));

// By conversion action + campaign + date.
const rows = await customer.query(`
  SELECT campaign.name, segments.date, segments.conversion_action_name,
         metrics.conversions, metrics.conversions_value
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
    AND metrics.conversions > 0
  ORDER BY segments.date
`);

const table = rows.map((r) => ({
  date: r.segments?.date,
  campaign: r.campaign?.name,
  action: r.segments?.conversion_action_name,
  conv: d2(Number(r.metrics?.conversions ?? 0)),
  value: d2(Number(r.metrics?.conversions_value ?? 0)),
}));

console.log("\n=== Conversions by action / date — LAST 30 DAYS ===");
console.table(table);

// Which keyword/ad group drove the software-campaign conversions.
const kwRows = await customer.query(`
  SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text,
         segments.date, metrics.conversions, metrics.conversions_value
  FROM keyword_view
  WHERE segments.date DURING LAST_30_DAYS
    AND metrics.conversions > 0
  ORDER BY metrics.conversions_value DESC
`);
console.log("\n=== Converting keywords — LAST 30 DAYS ===");
console.table(kwRows.map((r) => ({
  date: r.segments?.date,
  campaign: r.campaign?.name,
  ad_group: r.ad_group?.name,
  keyword: r.ad_group_criterion?.keyword?.text,
  conv: d2(Number(r.metrics?.conversions ?? 0)),
  value: d2(Number(r.metrics?.conversions_value ?? 0)),
})));
