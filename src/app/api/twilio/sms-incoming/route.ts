/**
 * Inbound SMS webhook for the NunezDev Twilio number.
 *
 * Twilio's A2P 10DLC campaign auto-blocks STOP at the platform level for
 * registered campaigns — we cannot actually send to a number that has
 * replied STOP regardless of what we think. So this endpoint has two
 * jobs:
 *
 *   1. Mirror the opt-out state into our DB so our dashboard / cron skip
 *      sends for the right reason ('opted_out') instead of failing at
 *      Twilio with error 21610. Mirroring also lets us re-opt-in via
 *      START without round-tripping to Twilio support.
 *   2. Respond with appropriate TwiML for HELP / generic replies. Twilio
 *      handles STOP confirmation automatically — we don't echo it.
 *
 * We match the incoming `From` number against both clients.phone and
 * leads.phone (E.164 and last-10-digit variants) so opt-outs apply to
 * any record where that phone appears.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyTwilioWebhook } from '@/lib/twilioWebhook';
import { findOrCreateConversation, recordMessage } from '@/lib/inbox';

export const runtime = 'nodejs';

const STOP_KEYWORDS = new Set([
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
  'REVOKE',
  'OPTOUT',
  'OPT-OUT',
]);
const START_KEYWORDS = new Set(['START', 'UNSTOP', 'YES', 'OPTIN', 'OPT-IN']);
const HELP_KEYWORDS = new Set(['HELP', 'INFO']);

export async function POST(request: NextRequest) {
  const verdict = await verifyTwilioWebhook(request);
  if (!verdict.ok) {
    console.warn('[twilio/sms-incoming] signature check failed:', verdict.reason);
    return new NextResponse('Forbidden', { status: 403 });
  }

  const from = (verdict.params.From || '').trim();
  const body = (verdict.params.Body || '').trim();
  // First word, uppercased — keyword matching is whitespace + case
  // insensitive, but only checks the first token (Twilio convention).
  const firstWord = body.split(/\s+/)[0]?.toUpperCase() ?? '';

  if (!from) {
    return twimlResponse(emptyTwiml());
  }

  if (STOP_KEYWORDS.has(firstWord)) {
    await markOptedOut(from, body);
    // Twilio sends the platform-mandated confirmation message
    // automatically. Responding with an extra Message verb would queue
    // a duplicate. Return empty TwiML.
    return twimlResponse(emptyTwiml());
  }

  if (START_KEYWORDS.has(firstWord)) {
    await markOptedIn(from);
    return twimlResponse(
      messageTwiml(
        'NunezDev: You have re-subscribed to invoice reminders. Reply STOP to opt out at any time. Msg & data rates may apply.',
      ),
    );
  }

  if (HELP_KEYWORDS.has(firstWord)) {
    return twimlResponse(
      messageTwiml(
        'NunezDev: Invoice reminders. Reply STOP to opt out. For support email reece@nunezdev.com. Msg & data rates may apply.',
      ),
    );
  }

  // Any other inbound message — a real conversational reply. Thread it into
  // the inbox AND keep the client_activity_log audit entry. Don't auto-reply.
  // (STOP/START/HELP are deliberately NOT threaded — they're handled by the
  // opt-out flow above, not operator conversation.)
  await recordInboundSms(from, verdict.params.To || '', body, verdict.params.MessageSid);
  await logInbound(from, body);
  return twimlResponse(emptyTwiml());
}

/**
 * Thread an inbound text into the inbox: upsert the SMS conversation for this
 * number and record the message. Works even when the number matches no
 * client/lead (conversation still anchors on the phone). Idempotent on the
 * Twilio MessageSid so a webhook retry won't double-insert.
 *
 * Best-effort: a failure here must NOT break the webhook — opt-out handling
 * already ran and Twilio needs a 200 TwiML response, so we swallow + log.
 */
async function recordInboundSms(
  from: string,
  to: string,
  body: string,
  messageSid: string | undefined,
): Promise<void> {
  try {
    const conv = await findOrCreateConversation({ channel: 'sms', contactPhone: from });
    await recordMessage({
      conversationId: conv.id,
      direction: 'inbound',
      channel: 'sms',
      fromAddress: from,
      toAddress: to,
      bodyText: body,
      provider: 'twilio',
      providerId: messageSid ?? null,
      status: 'received',
    });
  } catch (err) {
    console.error('[sms-incoming] inbox record failed:', err);
  }
}

/**
 * Set sms_opted_out_at on every clients/leads row matching this phone.
 * We match in multiple shapes (E.164, bare 10-digit, with-1) so a number
 * stored as "(580) 555-1234" still opts out when STOP comes in as +15805551234.
 */
async function markOptedOut(fromE164: string, body: string): Promise<void> {
  const supabase = supabaseAdmin();
  const variants = phoneVariants(fromE164);
  const nowIso = new Date().toISOString();

  const { error: clientErr } = await supabase
    .from('clients')
    .update({ sms_opted_out_at: nowIso })
    .in('phone', variants)
    .is('sms_opted_out_at', null);
  if (clientErr) console.error('[sms-incoming] clients opt-out failed:', clientErr);

  const { error: leadErr } = await supabase
    .from('leads')
    .update({ sms_opted_out_at: nowIso })
    .in('phone', variants)
    .is('sms_opted_out_at', null);
  if (leadErr) console.error('[sms-incoming] leads opt-out failed:', leadErr);

  // Audit trail — we want this in client_activity_log even when we
  // can't pinpoint a single client (e.g. shared family phone). Insert
  // one row per matched client so the audit is per-record.
  const { data: matchedClients } = await supabase
    .from('clients')
    .select('id')
    .in('phone', variants);
  if (matchedClients?.length) {
    await supabase.from('client_activity_log').insert(
      matchedClients.map(c => ({
        client_id: c.id,
        activity_type: 'sms_opt_out',
        activity_data: {
          from_e164: fromE164,
          body_excerpt: body.slice(0, 80),
        },
      })),
    );
  }
}

/**
 * Re-opt-in via START. Mirrors markOptedOut but clears the timestamp
 * and only on records that previously consented (we don't grant fresh
 * consent here — START just reverses a prior STOP).
 */
async function markOptedIn(fromE164: string): Promise<void> {
  const supabase = supabaseAdmin();
  const variants = phoneVariants(fromE164);
  const { error } = await supabase
    .from('clients')
    .update({ sms_opted_out_at: null })
    .in('phone', variants)
    .eq('sms_consent', true);
  if (error) console.error('[sms-incoming] clients re-opt-in failed:', error);

  await supabase
    .from('leads')
    .update({ sms_opted_out_at: null })
    .in('phone', variants)
    .eq('sms_consent', true);
}

async function logInbound(fromE164: string, body: string): Promise<void> {
  const supabase = supabaseAdmin();
  const variants = phoneVariants(fromE164);
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .in('phone', variants)
    .limit(1);
  if (!clients?.length) return;
  await supabase.from('client_activity_log').insert({
    client_id: clients[0].id,
    activity_type: 'sms_inbound',
    activity_data: { from_e164: fromE164, body: body.slice(0, 500) },
  });
}

/**
 * Generate phone-number variants for DB matching. Twilio always sends
 * E.164 (+1NPANXXXXXX), but historical client records may have been
 * entered as "5805551234" or "(580) 555-1234" or "1-580-555-1234". To
 * cover those, we strip to digits and produce the canonical formats.
 */
function phoneVariants(input: string): string[] {
  const digits = input.replace(/\D/g, '');
  const variants = new Set<string>();
  variants.add(input);
  variants.add(digits);
  if (digits.length === 11 && digits.startsWith('1')) {
    variants.add(`+${digits}`);
    variants.add(digits.slice(1));
    variants.add(`+1${digits.slice(1)}`);
  }
  if (digits.length === 10) {
    variants.add(`+1${digits}`);
    variants.add(`1${digits}`);
  }
  return [...variants];
}

function twimlResponse(twiml: string): NextResponse {
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}
function emptyTwiml(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response/>';
}
function messageTwiml(text: string): string {
  // Twilio TwiML <Message> verb echoes a reply over SMS. Body text
  // needs XML-escaping; our messages are static so no escape required,
  // but be defensive in case the templates ever take user input.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}
