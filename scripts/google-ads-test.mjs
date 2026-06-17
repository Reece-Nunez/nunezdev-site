/**
 * Google Ads connectivity smoke test.
 *
 * Read-only. Loads .env.local, builds the same client the app uses, and runs a
 * tiny query against the account to confirm all five credentials actually work
 * together. Run after setting the GOOGLE_ADS_* vars:
 *
 *   node scripts/google-ads-test.mjs
 *
 * On success it prints the account name/currency and a 7-day campaign count.
 * On failure it surfaces Google's error code with a hint at the likely cause.
 */
import { GoogleAdsApi } from "google-ads-api";

try {
  const nextEnv = await import("@next/env");
  const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig;
  loadEnvConfig?.(process.cwd());
} catch {
  // fall back to shell env
}

const digits = (s) => (s || "").replace(/[^0-9]/g, "");

const {
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
  GOOGLE_ADS_CUSTOMER_ID,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID,
} = process.env;

const missing = [
  ["GOOGLE_ADS_DEVELOPER_TOKEN", GOOGLE_ADS_DEVELOPER_TOKEN],
  ["GOOGLE_ADS_CLIENT_ID", GOOGLE_ADS_CLIENT_ID],
  ["GOOGLE_ADS_CLIENT_SECRET", GOOGLE_ADS_CLIENT_SECRET],
  ["GOOGLE_ADS_REFRESH_TOKEN", GOOGLE_ADS_REFRESH_TOKEN],
  ["GOOGLE_ADS_CUSTOMER_ID", GOOGLE_ADS_CUSTOMER_ID],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error("Missing env vars:", missing.join(", "));
  process.exit(1);
}

const client = new GoogleAdsApi({
  client_id: GOOGLE_ADS_CLIENT_ID,
  client_secret: GOOGLE_ADS_CLIENT_SECRET,
  developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = client.Customer({
  customer_id: digits(GOOGLE_ADS_CUSTOMER_ID),
  login_customer_id: GOOGLE_ADS_LOGIN_CUSTOMER_ID
    ? digits(GOOGLE_ADS_LOGIN_CUSTOMER_ID)
    : undefined,
  refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
});

try {
  const acct = await customer.query(
    "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1",
  );
  const c = acct[0]?.customer ?? {};
  console.log("\n✅ Connected to Google Ads account:");
  console.log(`   id:       ${c.id}`);
  console.log(`   name:     ${c.descriptive_name ?? "(unnamed)"}`);
  console.log(`   currency: ${c.currency_code ?? "?"}`);
  console.log(`   timezone: ${c.time_zone ?? "?"}`);

  const campaigns = await customer.query(`
    SELECT campaign.id, metrics.cost_micros
    FROM campaign
    WHERE segments.date DURING LAST_7_DAYS
  `);
  const spend = campaigns.reduce((s, r) => s + Number(r.metrics?.cost_micros ?? 0), 0) / 1e6;
  console.log(
    `\n   last 7 days: ${campaigns.length} campaign-rows, $${spend.toFixed(2)} spend\n`,
  );
  process.exit(0);
} catch (err) {
  console.error("\n❌ Query failed.\n");
  // google-ads-api throws a GoogleAdsFailure with an `errors` array.
  const errs = err?.errors;
  if (Array.isArray(errs)) {
    for (const e of errs) {
      console.error(`   ${JSON.stringify(e.error_code)}: ${e.message}`);
    }
  } else {
    console.error(`   ${err?.message ?? err}`);
  }
  console.error(
    "\nCommon causes:\n" +
      "  • DEVELOPER_TOKEN_NOT_APPROVED / test-mode token → token only works on\n" +
      "    test accounts; apply for Basic access in the Ads API Center.\n" +
      "  • USER_PERMISSION_DENIED → the authorized Google account can't see this\n" +
      "    account, or you need GOOGLE_ADS_LOGIN_CUSTOMER_ID set to the manager id.\n" +
      "  • CUSTOMER_NOT_FOUND → wrong GOOGLE_ADS_CUSTOMER_ID (digits only, no dashes).\n",
  );
  process.exit(1);
}
