/**
 * Fix the account's conversion tracking so bidding runs on the healthy,
 * value-carrying `generate_lead` event instead of the misconfigured
 * "Contact Us" conversion.
 *
 * All three currently-active conversions (Contact Us + 2 Local actions) are
 * "Misconfigured" — the account effectively has no working conversion driving
 * bidding. The GA4 `generate_lead` event (which now carries per-lead values)
 * has a conversion action that's just hidden. This script:
 *   1. Enables "nunezdev (web) generate_lead" and makes it PRIMARY.
 *   2. Ensures its goal (Submit lead form) is a biddable account-level goal.
 *   3. Demotes Contact Us + both Local actions to SECONDARY.
 *
 * Dry-run by default. Pass --commit to apply. Idempotent.
 *   node scripts/ads-fix-conversions.mjs            (dry-run)
 *   node scripts/ads-fix-conversions.mjs --commit
 *
 * Creds read from .env.local (never printed).
 */
import { readFileSync } from "node:fs";
import { GoogleAdsApi, enums } from "google-ads-api";

const COMMIT = process.argv.includes("--commit");

const PRIMARY_NAME = "nunezdev (web) generate_lead";
// Only user-managed conversions can be demoted. The "Local actions" are
// Google-hosted (origin=GOOGLE_HOSTED) and immutable via the API — but their
// goals (Engagement, Page view) are already excluded from account-level goals,
// so they never drive bidding. We skip them (and warn) rather than fail.
const DEMOTE_NAMES = [
  "Contact Us",
  "Local actions - Other engagements",
  "Local actions - Website visits",
];
const GOOGLE_HOSTED_ORIGIN = 3;

// ConversionActionCategory enum → label, for a readable dry-run.
const CAT = {
  2: "DEFAULT", 3: "PAGE_VIEW", 4: "PURCHASE", 5: "SIGNUP", 6: "LEAD",
  7: "DOWNLOAD", 11: "PHONE_CALL_LEAD", 12: "IMPORTED_LEAD",
  13: "SUBMIT_LEAD_FORM", 14: "BOOK_APPOINTMENT", 18: "CONTACT",
  19: "ENGAGEMENT", 20: "STORE_VISIT", 22: "QUALIFIED_LEAD", 23: "CONVERTED_LEAD",
};
const catLabel = (c) => CAT[c] ?? String(c);

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

// --- read conversion actions ---
const caRows = await customer.query(`
  SELECT conversion_action.resource_name, conversion_action.name, conversion_action.status,
         conversion_action.category, conversion_action.origin, conversion_action.primary_for_goal
  FROM conversion_action
`);
const byName = new Map(caRows.map((r) => [r.conversion_action.name, r.conversion_action]));

// --- read customer conversion goals (which goals drive account-level bidding) ---
const goalRows = await customer.query(`
  SELECT customer_conversion_goal.resource_name, customer_conversion_goal.category,
         customer_conversion_goal.origin, customer_conversion_goal.biddable
  FROM customer_conversion_goal
`);

const primary = byName.get(PRIMARY_NAME);
if (!primary) {
  console.error(`Could not find conversion action "${PRIMARY_NAME}".`);
  process.exit(1);
}

console.log("Current conversion actions:");
for (const r of caRows) {
  const ca = r.conversion_action;
  console.log(`  · ${ca.name} — status=${ca.status} category=${catLabel(ca.category)} primary=${ca.primary_for_goal}`);
}

// Goal that generate_lead belongs to (match category + origin).
const primaryGoal = goalRows.find(
  (g) => g.customer_conversion_goal.category === primary.category &&
         g.customer_conversion_goal.origin === primary.origin,
);

console.log("\nAccount-level goals (biddable = drives bidding):");
for (const g of goalRows) {
  const cg = g.customer_conversion_goal;
  console.log(`  · ${catLabel(cg.category)} / origin ${cg.origin} — biddable=${cg.biddable}`);
}

console.log("\nPlan:");
const caUpdates = [];
// 1. enable + promote generate_lead
if (primary.status !== enums.ConversionActionStatus.ENABLED || !primary.primary_for_goal) {
  console.log(`  ~ ${PRIMARY_NAME}: status→ENABLED, primary_for_goal→true`);
  caUpdates.push({ resource_name: primary.resource_name, status: enums.ConversionActionStatus.ENABLED, primary_for_goal: true });
} else {
  console.log(`  = ${PRIMARY_NAME}: already enabled + primary`);
}
// 2. demote the misconfigured ones
for (const name of DEMOTE_NAMES) {
  const ca = byName.get(name);
  if (!ca) { console.log(`  ! "${name}" not found — skipping`); continue; }
  if (ca.origin === GOOGLE_HOSTED_ORIGIN) {
    console.log(`  ⊘ ${name}: Google-hosted / immutable — skipped (its goal isn't biddable, so it doesn't drive bidding)`);
    continue;
  }
  if (ca.primary_for_goal) {
    console.log(`  ~ ${name}: primary_for_goal→false (secondary)`);
    caUpdates.push({ resource_name: ca.resource_name, primary_for_goal: false });
  } else {
    console.log(`  = ${name}: already secondary`);
  }
}
// 3. make generate_lead's goal biddable. The Submit-lead-form goal usually
// doesn't exist until generate_lead is active, so this is handled AFTER the
// enable in the commit phase (re-query, then set biddable).
if (primaryGoal) {
  console.log(`  ~ Goal ${catLabel(primary.category)}: ensure biddable=true (currently ${primaryGoal.customer_conversion_goal.biddable})`);
} else {
  console.log(`  ~ Goal ${catLabel(primary.category)}: will be created when generate_lead is enabled — then set biddable=true`);
}

if (!COMMIT) {
  console.log("\n[DRY-RUN] No changes written. Re-run with --commit to apply.");
  process.exit(0);
}

// Phase 1: conversion-action changes (this is what creates the Submit-lead-form goal).
if (caUpdates.length) {
  await customer.conversionActions.update(caUpdates);
  console.log(`\n✅ Updated ${caUpdates.length} conversion actions.`);
}

// Phase 2: re-read goals (Submit lead form now exists) and ensure it's biddable.
const goalRows2 = await customer.query(`
  SELECT customer_conversion_goal.resource_name, customer_conversion_goal.category,
         customer_conversion_goal.origin, customer_conversion_goal.biddable
  FROM customer_conversion_goal
`);
const g2 = goalRows2.find(
  (g) => g.customer_conversion_goal.category === primary.category &&
         g.customer_conversion_goal.origin === primary.origin,
);
if (g2 && !g2.customer_conversion_goal.biddable) {
  await customer.customerConversionGoals.update([{ resource_name: g2.customer_conversion_goal.resource_name, biddable: true }]);
  console.log(`✅ Set ${catLabel(primary.category)} goal biddable=true (included in account-level goals).`);
} else if (g2) {
  console.log(`= ${catLabel(primary.category)} goal already biddable.`);
} else {
  console.log(`! ${catLabel(primary.category)} goal not visible yet — verify in Ads UI → Goals that "Submit lead form" is a primary account-level goal (it may take a minute to appear).`);
}

console.log(`\ngenerate_lead is now the primary biddable lead conversion. Give it a few days of data, then consider Max Conversion Value bidding.`);
