/**
 * Add campaign-level negative keywords to the search campaign.
 *
 * Dry-run by default (prints the plan, writes nothing). Pass --commit to
 * actually create the negatives. Idempotent: negatives already present on the
 * campaign are detected and skipped, so re-running is safe.
 *
 * Read:   node scripts/ads-add-negatives.mjs           (dry-run)
 * Write:  node scripts/ads-add-negatives.mjs --commit
 *
 * Creds are read from .env.local (never printed).
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums } from "google-ads-api";

const COMMIT = process.argv.includes("--commit");
const CAMPAIGN_NAME = "NunezDev - Search - US";

// Every negative below maps to real wasted spend in the last-30-day search
// terms report — DIY/how-to, free/template/theme shoppers, personal-portfolio
// builders, and big-agency listicle hunters. All PHRASE match so multi-word
// negatives ("how to") only block when the phrase actually appears.
const NEGATIVES = [
  // DIY / how-to
  "how to", "how do i", "how do you", "maker", "builder",
  "make a website", "create a website", "build a website",
  "create your own", "create my own", "diy", "tutorial", "learn",
  // Free / cheap
  "free", "cheap",
  // Templates / themes / tools
  "template", "templates", "theme", "carrd", "wix", "squarespace",
  "webflow", "readymag", "bootstrap", "astra", "elementor", "wordpress theme",
  // Personal / portfolio
  "portfolio", "artist", "music", "webcomic",
  // Listicles / big agency / jobs
  "top 10", "top 5", "companies in usa", "jobs", "salary", "course",
];

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

// Resolve the campaign id by name.
const campRows = await customer.query(`
  SELECT campaign.id, campaign.name, campaign.status
  FROM campaign
  WHERE campaign.name = '${CAMPAIGN_NAME}'
`);
if (!campRows.length) {
  console.error(`Campaign not found: "${CAMPAIGN_NAME}"`);
  process.exit(1);
}
const campaignId = campRows[0].campaign.id;
console.log(`Campaign: "${CAMPAIGN_NAME}" (id ${campaignId}, status ${campRows[0].campaign.status})`);

// Pull existing negative keywords so we never create duplicates.
const existingRows = await customer.query(`
  SELECT campaign_criterion.keyword.text, campaign_criterion.negative, campaign_criterion.type
  FROM campaign_criterion
  WHERE campaign.id = ${campaignId}
    AND campaign_criterion.negative = true
    AND campaign_criterion.type = 'KEYWORD'
`);
const existing = new Set(
  existingRows.map((r) => (r.campaign_criterion?.keyword?.text ?? "").toLowerCase()),
);

const toAdd = NEGATIVES.filter((n) => !existing.has(n.toLowerCase()));
const skipped = NEGATIVES.filter((n) => existing.has(n.toLowerCase()));

console.log(`\nExisting negatives on campaign: ${existing.size}`);
console.log(`Will ADD ${toAdd.length}: ${toAdd.join(", ")}`);
if (skipped.length) console.log(`Skipping ${skipped.length} already present: ${skipped.join(", ")}`);

if (!COMMIT) {
  console.log("\n[DRY-RUN] No changes written. Re-run with --commit to apply.");
  process.exit(0);
}

if (toAdd.length === 0) {
  console.log("\nNothing to add — all negatives already present.");
  process.exit(0);
}

const operations = toAdd.map((text) => ({
  campaign: `customers/${customerId}/campaigns/${campaignId}`,
  negative: true,
  keyword: { text, match_type: enums.KeywordMatchType.PHRASE },
}));

const res = await customer.campaignCriteria.create(operations);
console.log(`\n✅ Added ${res.results?.length ?? operations.length} negative keywords to "${CAMPAIGN_NAME}".`);
