/**
 * "Answered?" bridge between the leadgen pipeline and the CRM inbox.
 *
 * A prospect reply flips the pipeline business to 'replied', which lights the
 * "N leads replied — needs your attention" banner on the leadgen dashboard.
 * But when the operator answers from the inbox (/api/inbox/send), only
 * public.messages is written — the pipeline never hears about it, so the
 * business stays 'replied' and the banner never clears.
 *
 * Rather than mutate the pipeline status (and fight the reply-sync cron, which
 * re-scans 'contacted' email leads and would re-flip them back to 'replied'),
 * we make the banner answer-aware: a replied lead only "needs attention" while
 * the operator hasn't texted/emailed back since the prospect's most recent
 * inbound message. Both schemas share one Supabase DB, so this lives entirely
 * on the CRM side — no pipeline deploy needed.
 *
 * The pure helpers (isReplyAnswered / contactKeys / countUnansweredReplies)
 * carry the logic and are unit-tested; countUnansweredReplyLeads does the DB
 * fan-out and folds the result through them.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhoneE164 } from '@/lib/sms';

/** A leadgen prospect currently in 'replied', with its raw contact fields. */
export interface RepliedContact {
  id: number;
  phone: string | null;
  email: string | null;
}

/** The latest inbound/outbound timestamps (epoch ms) for a thread. */
export interface ContactActivity {
  lastInbound: number | null;
  lastOutbound: number | null;
}

/** max() that treats null as "no value" rather than 0. */
function maxNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

/**
 * A reply is "answered" once we've sent something back at or after the
 * prospect's most recent inbound message. No outbound at all → unanswered. An
 * outbound with no inbound on record (e.g. an email reply the Gmail poller
 * logged to the pipeline but not the inbox, which we then answered) counts as
 * answered — we clearly engaged the thread.
 */
export function isReplyAnswered(a: ContactActivity): boolean {
  if (a.lastOutbound == null) return false;
  if (a.lastInbound == null) return true;
  return a.lastOutbound >= a.lastInbound;
}

/**
 * Inbox match keys for a contact: E.164 phone (SMS threads) + lowercased email
 * (email threads). Both optional; an un-normalizable phone or blank email is
 * dropped. Keys line up with how findOrCreateConversation stores a thread's
 * contact_phone (normalized to E.164) and contact_email (lowercased).
 */
export function contactKeys(c: RepliedContact): string[] {
  const keys: string[] = [];
  const phone = c.phone ? normalizePhoneE164(c.phone) : null;
  if (phone) keys.push(phone);
  const email = c.email?.trim().toLowerCase();
  if (email) keys.push(email);
  return keys;
}

/**
 * Count replied prospects the operator hasn't answered yet. `activityByKey`
 * maps a contact key (E.164 phone or lowercased email) to that thread's last
 * inbound/outbound timestamps; a contact's activity is merged across all its
 * keys (a lead reachable by both phone and email takes the latest of each). A
 * contact with no matching key/activity has never been answered → counted.
 */
export function countUnansweredReplies(
  contacts: RepliedContact[],
  activityByKey: Map<string, ContactActivity>,
): number {
  let unanswered = 0;
  for (const c of contacts) {
    const merged: ContactActivity = { lastInbound: null, lastOutbound: null };
    for (const key of contactKeys(c)) {
      const act = activityByKey.get(key);
      if (!act) continue;
      merged.lastInbound = maxNullable(merged.lastInbound, act.lastInbound);
      merged.lastOutbound = maxNullable(merged.lastOutbound, act.lastOutbound);
    }
    if (!isReplyAnswered(merged)) unanswered += 1;
  }
  return unanswered;
}

/**
 * For the given replied prospects, count how many still need a reply — i.e.
 * we haven't messaged back since their last inbound. Matches inbox
 * conversations by E.164 phone (SMS) and email (email), folds each thread's
 * messages into last-inbound/last-outbound timestamps, and defers the decision
 * to countUnansweredReplies.
 *
 * Returns null on any DB error so the caller can fall back to the raw replied
 * count — we must never SILENTLY hide a lead that genuinely needs attention.
 */
export async function countUnansweredReplyLeads(
  contacts: RepliedContact[],
): Promise<number | null> {
  if (contacts.length === 0) return 0;

  const phones = new Set<string>();
  const emails = new Set<string>();
  for (const c of contacts) {
    for (const key of contactKeys(c)) {
      (key.startsWith('+') ? phones : emails).add(key);
    }
  }
  // No reachable identity on any replied lead → none could have been answered.
  if (phones.size === 0 && emails.size === 0) return contacts.length;

  try {
    const supabase = supabaseAdmin();

    // Pull conversations for these prospects. Two narrow .in() queries (phone,
    // email) avoid the quoting pitfalls of a combined .or() over E.164 values;
    // the replied set is small so this is cheap. Dedupe by id — one contact can
    // match both an SMS and an email thread.
    const convById = new Map<
      string,
      { id: string; contact_phone: string | null; contact_email: string | null }
    >();
    if (phones.size) {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, contact_phone, contact_email')
        .in('contact_phone', [...phones]);
      if (error) throw error;
      for (const c of data ?? []) convById.set(c.id, c);
    }
    if (emails.size) {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, contact_phone, contact_email')
        .in('contact_email', [...emails]);
      if (error) throw error;
      for (const c of data ?? []) convById.set(c.id, c);
    }
    const convs = [...convById.values()];
    if (convs.length === 0) return contacts.length; // nothing threaded → all unanswered

    // Last inbound + last outbound per conversation.
    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('conversation_id, direction, created_at')
      .in('conversation_id', convs.map((c) => c.id));
    if (msgErr) throw msgErr;

    const activityByConv = new Map<string, ContactActivity>();
    for (const m of msgs ?? []) {
      const ts = Date.parse(m.created_at as string);
      if (Number.isNaN(ts)) continue;
      const act = activityByConv.get(m.conversation_id) ?? {
        lastInbound: null,
        lastOutbound: null,
      };
      if (m.direction === 'inbound') act.lastInbound = maxNullable(act.lastInbound, ts);
      else act.lastOutbound = maxNullable(act.lastOutbound, ts);
      activityByConv.set(m.conversation_id, act);
    }

    // Re-key from conversation id to the contact keys the counter uses.
    const activityByKey = new Map<string, ContactActivity>();
    for (const conv of convs) {
      const act = activityByConv.get(conv.id);
      if (!act) continue;
      for (const key of [conv.contact_phone, conv.contact_email?.toLowerCase()]) {
        if (!key) continue;
        const prev = activityByKey.get(key) ?? { lastInbound: null, lastOutbound: null };
        activityByKey.set(key, {
          lastInbound: maxNullable(prev.lastInbound, act.lastInbound),
          lastOutbound: maxNullable(prev.lastOutbound, act.lastOutbound),
        });
      }
    }

    return countUnansweredReplies(contacts, activityByKey);
  } catch (err) {
    console.error('[leadgenInbox] unanswered-count failed:', err);
    return null;
  }
}
