/**
 * READ-ONLY: pull the Google Ads Search Terms report for the last 30 days.
 *
 * This is the one report the nightly sync doesn't capture — it shows the
 * ACTUAL queries people typed to trigger our ads, which is where the wasted
 * spend hides. Output is a ranked table; nothing is written to the account.
 *
 * Run:  node scripts/ads-search-terms.mjs
 * Creds are read from .env.local (never printed).
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi } from "google-ads-api";

// Minimal .env.local loader — this is a standalone script, so Next.js isn't
// here to inject env vars. Parses KEY=value, tolerates quotes and comments.
function loadEnv(path) {
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadEnv(".env.local");
const digits = (s) => (s ?? "").replace(/[^0-9]/g, "");

const required = [
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error("Missing env vars:", missing.join(", "));
  process.exit(1);
}

const api = new GoogleAdsApi({
  client_id: env.GOOGLE_ADS_CLIENT_ID,
  client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = api.Customer({
  customer_id: digits(env.GOOGLE_ADS_CUSTOMER_ID),
  login_customer_id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
    ? digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
    : undefined,
  refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
});

// SearchTermTargetingStatus enum -> label. Tells us whether a query is
// already a keyword, already excluded, or unmanaged (the candidates to act on).
const STATUS = { 0: "?", 1: "?", 2: "added", 3: "excluded", 4: "added+excl", 5: "none" };

const rows = await customer.query(`
  SELECT
    search_term_view.search_term,
    search_term_view.status,
    segments.keyword.info.text,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions
  FROM search_term_view
  WHERE segments.date DURING LAST_30_DAYS
  ORDER BY metrics.cost_micros DESC
  LIMIT 200
`);

let totCost = 0;
let totClicks = 0;
const table = rows.map((r) => {
  const cost = (r.metrics?.cost_micros ?? 0) / 1e6;
  totCost += cost;
  totClicks += r.metrics?.clicks ?? 0;
  return {
    term: r.search_term_view?.search_term ?? "",
    triggered_by: r.segments?.keyword?.info?.text ?? "",
    status: STATUS[r.search_term_view?.status] ?? String(r.search_term_view?.status),
    impr: r.metrics?.impressions ?? 0,
    clicks: r.metrics?.clicks ?? 0,
    cost: Number(cost.toFixed(2)),
    conv: r.metrics?.conversions ?? 0,
  };
});

console.log(`\nSearch terms (last 30 days) — ${table.length} rows`);
console.log(`Total in this list: $${totCost.toFixed(2)} across ${totClicks} clicks\n`);
console.table(table);
