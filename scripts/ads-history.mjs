/**
 * READ-ONLY: long-range spend vs conversions, to answer "is this worth it?"
 * Monthly totals for the account (last ~13 months) + all-time lifetime totals.
 *
 * Run:  node scripts/ads-history.mjs
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

// Monthly totals across an explicit wide date range (segments.month yields the
// first-of-month date).
const wide = await customer.query(`
  SELECT segments.month, metrics.impressions, metrics.clicks,
         metrics.cost_micros, metrics.conversions, metrics.conversions_value
  FROM customer
  WHERE segments.date BETWEEN '2025-01-01' AND '2026-07-31'
`);

const byMonth = new Map();
let life = { impr: 0, clicks: 0, cost: 0, conv: 0, val: 0 };
for (const r of wide) {
  const m = r.segments?.month;
  const c = byMonth.get(m) ?? { impr: 0, clicks: 0, cost: 0, conv: 0, val: 0 };
  const cost = Number(r.metrics?.cost_micros ?? 0) / 1e6;
  c.impr += Number(r.metrics?.impressions ?? 0);
  c.clicks += Number(r.metrics?.clicks ?? 0);
  c.cost += cost;
  c.conv += Number(r.metrics?.conversions ?? 0);
  c.val += Number(r.metrics?.conversions_value ?? 0);
  byMonth.set(m, c);
  life.impr += Number(r.metrics?.impressions ?? 0);
  life.clicks += Number(r.metrics?.clicks ?? 0);
  life.cost += cost;
  life.conv += Number(r.metrics?.conversions ?? 0);
  life.val += Number(r.metrics?.conversions_value ?? 0);
}

const table = [...byMonth.entries()].sort().map(([month, c]) => ({
  month, impr: c.impr, clicks: c.clicks, cost: d2(c.cost),
  conv: d2(c.conv), "conv value": d2(c.val),
  "cost/conv": c.conv > 0 ? d2(c.cost / c.conv) : null,
}));

console.log("\n=== Monthly account totals (Jan 2025 → Jul 2026) ===");
console.table(table);
console.log("\n=== LIFETIME in this window ===");
console.log(`Spend: $${d2(life.cost)}  ·  Clicks: ${life.clicks}  ·  Conversions: ${d2(life.conv)}  ·  Conv value: $${d2(life.val)}`);
console.log(`Blended cost/conversion: ${life.conv > 0 ? "$" + d2(life.cost / life.conv) : "—"}`);
