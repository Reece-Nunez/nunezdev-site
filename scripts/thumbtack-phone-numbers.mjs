/**
 * CLI to manage Thumbtack "associate phone numbers" for a business — the
 * numbers Thumbtack uses for lead communications and caller ID.
 *
 * Auth is OAuth2 authorization_code (see src/lib/thumbtackApi.ts): the owner
 * must first consent once at /api/thumbtack on the deployed site, which stores
 * an access+refresh token in the thumbtack_oauth_tokens table. This CLI reads
 * that stored token (refreshing as needed) — it does NOT mint its own. If no
 * token is stored yet it fails with a "not connected" message.
 *
 * Env comes from .env.local via @next/env. Defaults to STAGING; pass
 * --env production (or set THUMBTACK_ENV=production) to hit live. Because the
 * stored token isn't env-tagged, run with the SAME --env you consented under.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   (to read the token)
 *   staging:    THUMBTACK_STAGING_CLIENT_ID / THUMBTACK_STAGING_CLIENT_SECRET
 *               (falls back to THUMBTACK_CLIENT_ID / THUMBTACK_CLIENT_SECRET)
 *   production: THUMBTACK_CLIENT_ID / THUMBTACK_CLIENT_SECRET  (for refresh)
 *
 * Run (note the tsx loader — this imports the TypeScript client):
 *   node --import tsx scripts/thumbtack-phone-numbers.mjs list   --business <businessID>
 *   node --import tsx scripts/thumbtack-phone-numbers.mjs create --business <businessID> --phone 405-555-1234 [--name "Main line"]
 *   node --import tsx scripts/thumbtack-phone-numbers.mjs update --business <businessID> --id <phoneNumberID> [--phone ...] [--name ...]
 *   node --import tsx scripts/thumbtack-phone-numbers.mjs delete --business <businessID> --id <phoneNumberID>
 *
 * Add --env production to target live. Add --env staging to be explicit.
 */
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  return fallback;
}

function usageAndExit() {
  console.error(
    'Usage: node --import tsx scripts/thumbtack-phone-numbers.mjs <list|create|update|delete> --business <id> [--id <phoneNumberID>] [--phone <number>] [--name <name>] [--env staging|production]'
  );
  process.exit(1);
}

const command = process.argv[2];
if (!command || !['list', 'create', 'update', 'delete'].includes(command)) usageAndExit();

// Let --env override THUMBTACK_ENV before the client reads config.
const envFlag = arg('env');
if (envFlag) process.env.THUMBTACK_ENV = envFlag;

// Imported after env is loaded/overridden; the client reads config lazily.
const {
  resolveThumbtackConfig,
  listAssociatePhoneNumbers,
  createAssociatePhoneNumber,
  updateAssociatePhoneNumber,
  deleteAssociatePhoneNumber,
  normalizeThumbtackPhone,
} = await import('../src/lib/thumbtackApi.ts');

async function main() {
  const business = arg('business');
  if (!business) {
    console.error('ERROR: --business <businessID> is required');
    process.exit(1);
  }

  const cfg = resolveThumbtackConfig();
  console.log(`• env=${cfg.env}  host=${cfg.apiHost}  business=${business}`);

  if (command === 'list') {
    const numbers = await listAssociatePhoneNumbers(business);
    if (!numbers.length) {
      console.log('  (no associate phone numbers)');
      return;
    }
    for (const n of numbers) {
      const label = n.name ? ` "${n.name}"` : '';
      const deleted = n.isDeleted ? ' [deleted]' : '';
      console.log(`  ${n.phoneNumberID}  ${n.phoneNumber}${label}${deleted}`);
    }
    return;
  }

  if (command === 'create') {
    const raw = arg('phone');
    if (!raw) {
      console.error('ERROR: --phone <number> is required for create');
      process.exit(1);
    }
    const phoneNumber = normalizeThumbtackPhone(raw);
    if (!phoneNumber) {
      console.error(`ERROR: could not normalize "${raw}" to US E.164 (e.g. +14055551234)`);
      process.exit(1);
    }
    const name = arg('name');
    const created = await createAssociatePhoneNumber(business, name ? { phoneNumber, name } : { phoneNumber });
    console.log(`• created ${created.phoneNumberID} -> ${created.phoneNumber}`);
    return;
  }

  if (command === 'update') {
    const id = arg('id');
    if (!id) {
      console.error('ERROR: --id <phoneNumberID> is required for update');
      process.exit(1);
    }
    const raw = arg('phone');
    const name = arg('name');
    const input = {};
    if (raw) {
      const phoneNumber = normalizeThumbtackPhone(raw);
      if (!phoneNumber) {
        console.error(`ERROR: could not normalize "${raw}" to US E.164 (e.g. +14055551234)`);
        process.exit(1);
      }
      input.phoneNumber = phoneNumber;
    }
    if (name != null) input.name = name;
    if (!('phoneNumber' in input) && !('name' in input)) {
      console.error('ERROR: update needs at least one of --phone or --name');
      process.exit(1);
    }
    const updated = await updateAssociatePhoneNumber(business, id, input);
    console.log(`• updated ${updated.phoneNumberID} -> ${updated.phoneNumber}${updated.name ? ` "${updated.name}"` : ''}`);
    return;
  }

  if (command === 'delete') {
    const id = arg('id');
    if (!id) {
      console.error('ERROR: --id <phoneNumberID> is required for delete');
      process.exit(1);
    }
    await deleteAssociatePhoneNumber(business, id);
    console.log(`• deleted ${id}`);
    return;
  }
}

main().catch((err) => {
  console.error('FAILED:', err?.message || err);
  process.exit(1);
});
