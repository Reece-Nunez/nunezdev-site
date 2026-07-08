/**
 * READ-ONLY: performance snapshot to answer "is this actually working?"
 *
 * Prints (a) per-campaign totals for the last 30 days and (b) an account-wide
 * daily breakdown for the last 14 days, so the post-restructure period can be
 * read off directly. Nothing is written to the account.
 *
 * Run:  node scripts/ads-report.mjs
 * Creds are read from .env.local (never printed).
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
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
const cpl = (cost, conv) => (conv > 0 ? d2(cost / conv) : null);

// ── (a) per-campaign totals, last 30 days ─────────────────────────────────
const campRows = await customer.query(`
  SELECT campaign.name, campaign.status, campaign.advertising_channel_type,
         metrics.impressions, metrics.clicks, metrics.cost_micros,
         metrics.conversions, metrics.conversions_value
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
    AND campaign.status != 'REMOVED'
`);

const byCampaign = new Map();
for (const r of campRows) {
  const key = r.campaign.name;
  const c = byCampaign.get(key) ?? { impr: 0, clicks: 0, cost: 0, conv: 0, val: 0, status: r.campaign.status, type: r.campaign.advertising_channel_type };
  c.impr += Number(r.metrics?.impressions ?? 0);
  c.clicks += Number(r.metrics?.clicks ?? 0);
  c.cost += Number(r.metrics?.cost_micros ?? 0) / 1e6;
  c.conv += Number(r.metrics?.conversions ?? 0);
  c.val += Number(r.metrics?.conversions_value ?? 0);
  byCampaign.set(key, c);
}

const campTable = [...byCampaign.entries()].map(([name, c]) => ({
  campaign: name,
  status: c.status,
  impr: c.impr,
  clicks: c.clicks,
  cost: d2(c.cost),
  conv: d2(c.conv),
  "cost/conv": cpl(c.cost, c.conv),
  "conv value": d2(c.val),
}));

const tot = campTable.reduce((a, r) => ({ cost: a.cost + r.cost, clicks: a.clicks + r.clicks, conv: a.conv + r.conv, val: a.val + (r["conv value"] || 0) }), { cost: 0, clicks: 0, conv: 0, val: 0 });

console.log("\n=== Per-campaign totals — LAST 30 DAYS ===");
console.table(campTable);
console.log(`TOTAL: $${d2(tot.cost)} spend · ${tot.clicks} clicks · ${d2(tot.conv)} conversions · $${d2(tot.val)} conv value`);
console.log(`Blended cost/conversion: ${tot.conv > 0 ? "$" + cpl(tot.cost, tot.conv) : "— (0 conversions)"}`);

// ── (b) account-wide daily breakdown, last 14 days ────────────────────────
const dayRows = await customer.query(`
  SELECT segments.date, metrics.impressions, metrics.clicks,
         metrics.cost_micros, metrics.conversions
  FROM customer
  WHERE segments.date DURING LAST_14_DAYS
  ORDER BY segments.date
`);

const byDay = new Map();
for (const r of dayRows) {
  const day = r.segments?.date;
  const c = byDay.get(day) ?? { impr: 0, clicks: 0, cost: 0, conv: 0 };
  c.impr += Number(r.metrics?.impressions ?? 0);
  c.clicks += Number(r.metrics?.clicks ?? 0);
  c.cost += Number(r.metrics?.cost_micros ?? 0) / 1e6;
  c.conv += Number(r.metrics?.conversions ?? 0);
  byDay.set(day, c);
}

const dayTable = [...byDay.entries()].map(([date, c]) => ({
  date, impr: c.impr, clicks: c.clicks, cost: d2(c.cost), conv: d2(c.conv),
}));

console.log("\n=== Account daily — LAST 14 DAYS (restructure landed ~Jul 1) ===");
console.table(dayTable);
