/**
 * One-time backfill of Thumbtack lead details + inbound messages from Gmail
 * notification emails.
 *
 * WHY THIS EXISTS
 * ---------------
 * `thumbtack_events.external_id` carries a UNIQUE index and used to be keyed on
 * the per-THREAD negotiationID instead of the per-EVENT messageID (fixed in
 * 723e32c). Consequences:
 *   - the 2nd..Nth message of every conversation collided with the 1st and was
 *     acked as a Thumbtack redelivery, never stored;
 *   - a lead's NegotiationCreatedV4 and its opening MessageCreatedV4 share one
 *     negotiationID, so whichever landed second was evicted — usually costing
 *     the request details (category / budget / timeline).
 * Those payloads were rejected at INSERT, so they exist nowhere in Postgres.
 * Thumbtack's email notifications are the only surviving copy.
 *
 * WHAT IT CAN AND CANNOT RECOVER
 * ------------------------------
 * Thumbtack notifications are inbound-only by construction — they exist to tell
 * the pro a CUSTOMER did something. Reece's own outbound replies (sent from the
 * Thumbtack app) appear in no email and are NOT recoverable here; they need the
 * Partner API. Restored threads are therefore customer-side-only, which is why
 * every inserted message is stamped with a visible RECONSTRUCTED_SUBJECT marker
 * rather than being passed off as a faithful transcript.
 *
 * SAFETY PROPERTIES
 * -----------------
 *   - Idempotent. Messages are keyed provider_id = 'gmail:<msgId>:<idx>', which
 *     cannot collide with a real Thumbtack messageID. Re-running is a no-op.
 *   - Never overwrites. Lead fields are filled only where currently NULL, so a
 *     value that arrived by webhook always wins over an email-parsed one.
 *   - Validates the negotiationID reconstruction. Message emails carry a
 *     double-quoted-printable-mangled id (`=58` collapses to `X` because
 *     0x58 == 'X'), so the extractor rebuilt them as '58' + <16 digits>. That
 *     heuristic is NOT trusted: every id must already exist in the database or
 *     the row is skipped and reported.
 *   - Repairs the conversation tail. trg_messages_bump_conversation sets
 *     last_message_at = NEW.created_at and unread = true unconditionally, so
 *     inserting historical messages would drag threads backwards in the inbox
 *     list and mark them all unread. We snapshot `unread` beforehand and
 *     recompute the tail from the true newest message afterwards.
 *
 * Env (from .env.local via @next/env): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:
 *   node scripts/backfill-thumbtack-from-email.mjs --dry-run   # print, change nothing
 *   node scripts/backfill-thumbtack-from-email.mjs --apply
 *   node scripts/backfill-thumbtack-from-email.mjs --apply --data <path-to.json>
 */
import { readFileSync } from 'node:fs';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry-run') || !APPLY;
const dataFlag = args.indexOf('--data');
const DATA_PATH =
  dataFlag !== -1 && args[dataFlag + 1]
    ? args[dataFlag + 1]
    : 'C:\\Users\\reece\\AppData\\Local\\Temp\\claude\\C--Users-reece-Documents-NunezDev-nunezdev-site\\417dfa1e-f930-4044-8e67-10be1b701798\\scratchpad\\thumbtack-email-backfill.json';

// Shown as the message subject in the inbox UI. Deliberately explicit: these
// threads are missing every outbound reply, and a reader must not mistake them
// for the full conversation.
const RECONSTRUCTED_SUBJECT = 'Recovered from Thumbtack email — inbound only';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const log = (...a) => console.log(...a);
const plan = [];

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const leads = data.leads ?? [];
  const messages = data.messages ?? [];
  log(`${DRY ? 'DRY RUN' : 'APPLY'} — ${leads.length} lead records, ${messages.length} message records`);
  log(`source: ${DATA_PATH}\n`);

  // ── Load current state ────────────────────────────────────────────────
  const { data: dbLeads, error: leadErr } = await db
    .from('leads')
    .select('id, name, thumbtack_negotiation_id, project_type, budget, timeline')
    .not('thumbtack_negotiation_id', 'is', null);
  if (leadErr) throw leadErr;

  const { data: dbConvos, error: convoErr } = await db
    .from('conversations')
    .select('id, contact_name, contact_external_id, unread')
    .eq('channel', 'thumbtack');
  if (convoErr) throw convoErr;

  const leadByNeg = new Map(dbLeads.map((l) => [l.thumbtack_negotiation_id, l]));
  const convoByNeg = new Map(dbConvos.map((c) => [c.contact_external_id, c]));
  // The reconstruction guard: an id is trustworthy only if we already know it.
  const knownNegIds = new Set([...leadByNeg.keys(), ...convoByNeg.keys()]);

  // ── 1. Lead request details ───────────────────────────────────────────
  log('── Lead details ──');
  const seenLead = new Set();
  let leadUpdates = 0;
  for (const rec of leads) {
    if (!rec.negotiationId || seenLead.has(rec.negotiationId)) continue; // dupe lead emails exist
    seenLead.add(rec.negotiationId);

    const lead = leadByNeg.get(rec.negotiationId);
    if (!lead) {
      log(`  SKIP  ${rec.customerName} (${rec.negotiationId}) — no lead row`);
      continue;
    }
    // Fill only what is missing; a webhook-sourced value always wins.
    const patch = {};
    if (!lead.project_type && rec.category) patch.project_type = rec.category;
    if (!lead.budget && rec.budget) patch.budget = rec.budget;
    if (!lead.timeline && rec.timeline) patch.timeline = rec.timeline;
    if (!Object.keys(patch).length) {
      log(`  ok    ${lead.name} — already populated`);
      continue;
    }
    log(`  FILL  ${lead.name}: ${JSON.stringify(patch)}`);
    plan.push({ kind: 'lead', id: lead.id, patch });
    leadUpdates++;
  }

  // ── 2. Inbound messages ───────────────────────────────────────────────
  log('\n── Messages ──');
  const { data: existing, error: exErr } = await db
    .from('messages')
    .select('provider_id')
    .like('provider_id', 'gmail:%');
  if (exErr) throw exErr;
  const alreadyBackfilled = new Set((existing ?? []).map((m) => m.provider_id));

  let msgInserts = 0;
  const touchedConvos = new Set();
  for (const rec of messages) {
    const providerId = `gmail:${rec.gmailMessageId}:${rec.digestIndex ?? 0}`;
    if (alreadyBackfilled.has(providerId)) {
      log(`  ok    ${rec.customerName} — already backfilled`);
      continue;
    }
    if (!rec.negotiationId || !knownNegIds.has(rec.negotiationId)) {
      // The '58' + 16-digit reconstruction produced an id we cannot corroborate.
      log(`  SKIP  ${rec.customerName} (${rec.negotiationId}) — negotiationId not in DB, reconstruction unverified`);
      continue;
    }
    let convo = convoByNeg.get(rec.negotiationId);
    if (!convo) {
      const lead = leadByNeg.get(rec.negotiationId);
      log(`  NEW   conversation for ${rec.customerName} (${rec.negotiationId})`);
      plan.push({
        kind: 'conversation',
        negotiationId: rec.negotiationId,
        name: lead?.name ?? rec.customerName,
      });
      convo = { id: null, contact_external_id: rec.negotiationId };
      convoByNeg.set(rec.negotiationId, convo);
    }
    log(`  ADD   ${rec.customerName}: "${rec.text.slice(0, 60)}${rec.text.length > 60 ? '…' : ''}"`);
    plan.push({
      kind: 'message',
      negotiationId: rec.negotiationId,
      providerId,
      text: rec.text,
      createdAt: rec.emailDate,
      // Match the webhook's convention (from = customer display name, to =
      // business). Prefer the stored full name over the email's abbreviated
      // "Adrian W." so a thread doesn't mix both forms.
      fromAddress:
        convo.contact_name ??
        leadByNeg.get(rec.negotiationId)?.name ??
        rec.customerName,
    });
    touchedConvos.add(rec.negotiationId);
    msgInserts++;
  }

  log(`\nPlan: ${leadUpdates} lead update(s), ${msgInserts} message insert(s), ` +
      `${plan.filter((p) => p.kind === 'conversation').length} new conversation(s).`);

  if (DRY) {
    log('\nDry run — nothing written. Re-run with --apply.');
    return;
  }

  // ── Execute ───────────────────────────────────────────────────────────
  // Snapshot unread BEFORE inserting; the bump trigger forces it true.
  const unreadBefore = new Map(dbConvos.map((c) => [c.contact_external_id, c.unread]));

  for (const step of plan) {
    if (step.kind === 'lead') {
      const { error } = await db.from('leads').update(step.patch).eq('id', step.id);
      if (error) throw error;
    } else if (step.kind === 'conversation') {
      const { data, error } = await db
        .from('conversations')
        .insert({
          channel: 'thumbtack',
          contact_external_id: step.negotiationId,
          contact_name: step.name,
          status: 'open',
        })
        .select('id')
        .single();
      if (error) throw error;
      convoByNeg.get(step.negotiationId).id = data.id;
      unreadBefore.set(step.negotiationId, false);
    } else if (step.kind === 'message') {
      const convoId = convoByNeg.get(step.negotiationId).id;
      const { error } = await db.from('messages').insert({
        conversation_id: convoId,
        direction: 'inbound',
        channel: 'thumbtack',
        from_address: step.fromAddress,
        to_address: 'NunezDev',
        subject: RECONSTRUCTED_SUBJECT,
        body_text: step.text,
        provider_id: step.providerId,
        status: 'received',
        created_at: step.createdAt,
      });
      if (error) throw error;
    }
  }

  // ── Repair the conversation tail ──────────────────────────────────────
  // The bump trigger fired once per inserted row with the HISTORICAL created_at,
  // so last_message_at / preview / direction now reflect whichever backfilled
  // row happened to land last, and unread was forced true. Recompute from the
  // genuinely newest message and restore the prior unread state.
  log('\n── Repairing conversation tails ──');
  for (const negId of touchedConvos) {
    const convoId = convoByNeg.get(negId).id;
    const { data: newest, error } = await db
      .from('messages')
      .select('body_text, direction, created_at')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    const { error: upErr } = await db
      .from('conversations')
      .update({
        last_message_at: newest.created_at,
        last_message_preview: (newest.body_text ?? '').slice(0, 200),
        last_direction: newest.direction,
        unread: unreadBefore.get(negId) ?? false,
      })
      .eq('id', convoId);
    if (upErr) throw upErr;
    log(`  fixed ${negId} → ${newest.created_at}`);
  }

  log('\nDone.');
}

main().catch((e) => {
  console.error('FAILED:', e.message ?? e);
  process.exit(1);
});
