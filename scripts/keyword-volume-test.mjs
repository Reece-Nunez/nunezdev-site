/**
 * Keyword Planner search-volume smoke test (read-only).
 *
 * Proves we can pull LOCAL average-monthly search volume for a trade keyword,
 * which is the data behind the outreach "N people a month search for a {trade}
 * around {city}" line. Two steps, both against the live Ads API:
 *   1. Resolve a city name -> Google geo-target constant id (GAQL).
 *   2. generateKeywordIdeas for the keyword, geo-targeted, and read
 *      keyword_idea_metrics.avg_monthly_searches.
 *
 *   node scripts/keyword-volume-test.mjs [keyword] [city] [stateName]
 *   node scripts/keyword-volume-test.mjs plumber Stillwater Oklahoma
 *
 * Exits 0 and prints the monthly volume on success; non-zero with Google's
 * error code on failure (e.g. token without Keyword Planner / Basic access).
 */
import { GoogleAdsApi, enums } from "google-ads-api";

try {
  const nextEnv = await import("@next/env");
  const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig;
  loadEnvConfig?.(process.cwd());
} catch {
  // fall back to shell env
}

const digits = (s) => (s || "").replace(/[^0-9]/g, "");
const [, , kwArg, cityArg, stateArg] = process.argv;
const keyword = (kwArg || "plumber").toLowerCase();
const city = cityArg || "Stillwater";
const stateName = stateArg || "Oklahoma";

const {
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
  GOOGLE_ADS_CUSTOMER_ID,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID,
} = process.env;

const client = new GoogleAdsApi({
  client_id: GOOGLE_ADS_CLIENT_ID,
  client_secret: GOOGLE_ADS_CLIENT_SECRET,
  developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = client.Customer({
  customer_id: digits(GOOGLE_ADS_CUSTOMER_ID),
  login_customer_id: GOOGLE_ADS_LOGIN_CUSTOMER_ID ? digits(GOOGLE_ADS_LOGIN_CUSTOMER_ID) : undefined,
  refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
});

try {
  // 1. City -> geo-target constant. Match the city by name, then disambiguate
  //    on canonical_name (e.g. "Stillwater,Oklahoma,United States") since the
  //    same city name exists in several states.
  const geoRows = await customer.query(`
    SELECT
      geo_target_constant.id,
      geo_target_constant.name,
      geo_target_constant.canonical_name,
      geo_target_constant.target_type,
      geo_target_constant.country_code,
      geo_target_constant.status
    FROM geo_target_constant
    WHERE geo_target_constant.name = '${city.replace(/'/g, "")}'
      AND geo_target_constant.country_code = 'US'
      AND geo_target_constant.target_type = 'City'
  `);

  const match =
    geoRows.find((r) =>
      (r.geo_target_constant?.canonical_name ?? "")
        .toLowerCase()
        .includes(stateName.toLowerCase()),
    ) ?? geoRows[0];

  if (!match) {
    console.error(`\n❌ No geo-target constant found for "${city}, ${stateName}".`);
    process.exit(1);
  }
  const geoId = match.geo_target_constant.id;
  console.log(
    `\n📍 Geo: ${match.geo_target_constant.canonical_name} (geoTargetConstants/${geoId})`,
  );

  // 2. Keyword ideas, geo-targeted + English, read the seed's monthly volume.
  const ideas = await customer.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: digits(GOOGLE_ADS_CUSTOMER_ID),
    language: "languageConstants/1000", // English
    geo_target_constants: [`geoTargetConstants/${geoId}`],
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    keyword_seed: { keywords: [keyword] },
  });

  const exact = ideas.find((i) => (i.text ?? "").toLowerCase() === keyword);
  const row = exact ?? ideas[0];
  const vol = Number(row?.keyword_idea_metrics?.avg_monthly_searches ?? 0);

  console.log(`\n🔎 "${keyword}" near ${city}, ${stateName}:`);
  console.log(`   ~${vol.toLocaleString()} searches/month  (seed: "${row?.text}")`);
  console.log(`\n   Sample of related ideas (volume):`);
  for (const i of ideas.slice(0, 8)) {
    const v = Number(i.keyword_idea_metrics?.avg_monthly_searches ?? 0);
    console.log(`     ${String(v).padStart(7)}  ${i.text}`);
  }
  console.log("");
  process.exit(0);
} catch (err) {
  console.error("\n❌ Keyword Planner query failed.\n");
  const errs = err?.errors;
  if (Array.isArray(errs)) {
    for (const e of errs) console.error(`   ${JSON.stringify(e.error_code)}: ${e.message}`);
  } else {
    console.error(`   ${err?.message ?? err}`);
  }
  console.error(
    "\nLikely causes:\n" +
      "  • Token lacks Keyword Planner / Basic access → apply in Ads API Center.\n" +
      "  • Account has no Keyword Planner enabled.\n",
  );
  process.exit(1);
}
