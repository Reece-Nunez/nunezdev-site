/**
 * One-time helper to onboard a restricted "prospector" teammate (someone who
 * only gets the lead-generation surface — never financials).
 *
 * What it does, idempotently:
 *   1. Creates (or reuses) a Supabase auth user for the given email, tagged
 *      with app_metadata.role = 'prospector'. That flag is what middleware
 *      reads from the JWT to enforce the deny-by-default allowlist
 *      (see src/lib/prospectorAccess.ts).
 *   2. Upserts an org_members row (role 'prospector') in the owner's org so the
 *      per-route requireProspecting() guards resolve an org_id and the user
 *      sees the owner's leadgen/leads/thumbtack data.
 *   3. Generates a Supabase magic link to /dashboard/leadgen and (with --send)
 *      texts it via Twilio so they can sign in with one tap.
 *
 * Safe to re-run: createUser/insert are guarded, and you can regenerate a fresh
 * magic link any time (the previous one simply expires).
 *
 * Env (read from .env.local via @next/env): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, TWILIO_* (only needed with --send).
 *
 * Run (prints the link, does NOT text):
 *   node scripts/invite-prospector.mjs --email josh@example.com --phone 405-555-1234
 * Run and text the link:
 *   node scripts/invite-prospector.mjs --email josh@example.com --phone 405-555-1234 --send
 *
 * Optional flags:
 *   --org <uuid>     org to add them to (default: NunezDev owner org)
 *   --name <name>    first name used in the SMS copy (default: "there")
 *   --redirect <url> base app URL for the magic link (default: prod site)
 */
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { createClient } from '@supabase/supabase-js';
// twilio is CommonJS — default-import then pull Twilio off it (named ESM import fails).
import twilioPkg from 'twilio';
const { Twilio } = twilioPkg;

loadEnvConfig(process.cwd());

// --- args ---------------------------------------------------------------
function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  return fallback;
}
const SEND = process.argv.includes('--send');

const email = (arg('email') || '').trim().toLowerCase();
const phoneRaw = (arg('phone') || '').trim();
const firstName = arg('name', 'there');
// Magic links must land on the SAME origin the user will browse, so default to
// the production site, not the localhost value in NEXT_PUBLIC_APP_URL.
const redirectBase = (arg('redirect', 'https://www.nunezdev.com')).replace(/\/$/, '');
// NunezDev owner org (reece@nunezdev.com). Override with --org if needed.
const orgId = arg('org', '38a6ef02-f4dc-43c8-b5ce-bebbb8ff4728');

if (!email) {
  console.error('ERROR: --email is required');
  process.exit(1);
}
if (SEND && !phoneRaw) {
  console.error('ERROR: --phone is required when --send is set');
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** US-only E.164 normalization (mirrors src/lib/sms.ts). */
function normalizePhoneE164(input) {
  const digits = String(input).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

async function findUserByEmail(targetEmail) {
  // listUsers is paginated; scan a few pages defensively.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === targetEmail);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  // 1) Create or reuse the auth user, ensuring the prospector role flag.
  let user = await findUserByEmail(email);
  if (user) {
    console.log(`• Auth user already exists: ${user.id}`);
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata || {}), role: 'prospector' },
    });
    if (error) throw error;
    user = data.user;
    console.log('  ↳ ensured app_metadata.role = prospector');
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role: 'prospector' },
    });
    if (error) throw error;
    user = data.user;
    console.log(`• Created auth user: ${user.id} (role=prospector)`);
  }

  // 2) Upsert org membership so requireProspecting() can resolve an org_id.
  const { error: memErr } = await admin
    .from('org_members')
    .upsert({ org_id: orgId, user_id: user.id, role: 'prospector' }, { onConflict: 'org_id,user_id' });
  if (memErr) throw memErr;
  console.log(`• org_members upserted: org=${orgId} role=prospector`);

  // 3) Generate the magic link to the leadgen landing page.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${redirectBase}/dashboard/leadgen` },
  });
  if (linkErr) throw linkErr;
  const actionLink = linkData?.properties?.action_link;
  if (!actionLink) throw new Error('No action_link returned from generateLink');
  console.log(`\n• Magic link (expires ~1h):\n  ${actionLink}\n`);

  // 4) Optionally text it.
  const body =
    `Hey ${firstName}, Reece set you up on the NunezDev prospecting dashboard. ` +
    `Tap to sign in: ${actionLink}\n` +
    `(Link expires in ~1 hour. If it does, go to ${redirectBase}/login and tap "Send magic link" with this email.)`;

  if (!SEND) {
    console.log('Dry run (no --send). To text it, re-run with --send.');
    console.log('\nSMS preview:\n' + body);
    return;
  }

  const to = normalizePhoneE164(phoneRaw);
  if (!to) {
    console.error(`ERROR: could not normalize phone "${phoneRaw}" to US E.164`);
    process.exit(1);
  }
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    console.error('ERROR: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER required for --send');
    process.exit(1);
  }
  const twilio = new Twilio(accountSid, authToken);
  const msg = await twilio.messages.create({ to, from, body });
  console.log(`• SMS sent to ${to} (sid ${msg.sid})`);
}

main().catch((err) => {
  console.error('FAILED:', err?.message || err);
  process.exit(1);
});
