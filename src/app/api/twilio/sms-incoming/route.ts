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
import { findOrCreateConversation, recordMessage, resolveContact } from '@/lib/inbox';
import { sendTrackedSms } from '@/lib/smsOutbox';
import { buildWelcomeSms } from '@/lib/smsWelcome';
import { notifyInboundSms } from '@/lib/notifications';

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
  // First word, uppercased with punctuation stripped — keyword matching is
  // whitespace + case insensitive and ignores trailing punctuation, so real
  // replies like "Yes!" / "STOP." / "opt-out" still match. Only the first
  // token is checked (Twilio convention). Note: stripping non-letters maps
  // "OPT-OUT"->"OPTOUT" and "OPT-IN"->"OPTIN", both already in the sets.
  const firstWord = (body.split(/\s+/)[0] ?? '').toUpperCase().replace(/[^A-Z]/g, '');

  if (!from) {
    return twimlResponse(emptyTwiml());
  }

  const toNumber = verdict.params.To || '';

  // Thread EVERY inbound message into the inbox and ping the owner, BEFORE
  // keyword routing — so the dashboard is a complete two-way history and you
  // get an email + bell notification whenever a client texts, keyword or not.
  // recordMessage is idempotent on the Twilio MessageSid, so a webhook retry
  // won't double-thread.
  await recordInboundSms(from, toNumber, body, verdict.params.MessageSid);
  const contact = await resolveContact({ phone: from });
  await notifyInboundSms({
    fromE164: from,
    body,
    contactName: contact.contactName,
    orgId: contact.orgId,
  });

  if (STOP_KEYWORDS.has(firstWord)) {
    await markOptedOut(from, body);
    // Twilio sends the platform-mandated confirmation message
    // automatically. Responding with an extra Message verb would queue
    // a duplicate. Return empty TwiML.
    return twimlResponse(emptyTwiml());
  }

  if (START_KEYWORDS.has(firstWord)) {
    // A YES/START reply is an affirmative opt-in. Grant fresh consent (not
    // just reverse a prior STOP) so the double-opt-in loop completes, then
    // deliver the friendly "you're in" confirmation.
    //
    // Send it through the Twilio API (sendTrackedSms), NOT a TwiML <Message>
    // reply: a TwiML reply only reaches the client if the number's inbound
    // config honors it, and we saw it get recorded-but-not-delivered. The API
    // send is guaranteed delivery to the client's phone and threads the
    // confirmation into the inbox with a real provider SID. Empty TwiML back.
    const matchedName = await grantConsent(from);
    await sendTrackedSms({ to: from, body: buildWelcomeSms({ name: matchedName }) });
    return twimlResponse(emptyTwiml());
  }

  if (HELP_KEYWORDS.has(firstWord)) {
    await sendTrackedSms({
      to: from,
      body:
        "NunezDev here! 👋 We text invoices, quotes & project updates. Reply STOP to opt out anytime. Questions? Email reece@nunezdev.com. Msg & data rates may apply.",
    });
    return twimlResponse(emptyTwiml());
  }

  // Any other inbound message — a real conversational reply. Already threaded
  // + notified above; keep the client_activity_log audit entry too.
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
 * Grant SMS consent from an inbound YES/START reply — the back half of the
 * double opt-in. Unlike the old re-subscribe-only behavior, this sets
 * sms_consent=true on matching clients/leads (and clears any prior opt-out),
 * because a YES reply IS fresh, affirmative consent. Idempotent: re-texting
 * YES just re-affirms.
 *
 * Returns the first matched client/lead name (for the friendly reply), or
 * null when the number matches no record.
 */
async function grantConsent(fromE164: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const variants = phoneVariants(fromE164);
  const nowIso = new Date().toISOString();
  const consentUpdate = {
    sms_consent: true,
    sms_consent_at: nowIso,
    sms_consent_source: 'sms_reply',
    sms_opted_out_at: null,
  };

  const { error: clientErr } = await supabase
    .from('clients')
    .update(consentUpdate)
    .in('phone', variants);
  if (clientErr) console.error('[sms-incoming] clients opt-in failed:', clientErr);

  const { error: leadErr } = await supabase
    .from('leads')
    .update(consentUpdate)
    .in('phone', variants);
  if (leadErr) console.error('[sms-incoming] leads opt-in failed:', leadErr);

  // Audit trail + resolve a name for the confirmation reply.
  const { data: matchedClients } = await supabase
    .from('clients')
    .select('id, name')
    .in('phone', variants);
  if (matchedClients?.length) {
    await supabase.from('client_activity_log').insert(
      matchedClients.map((c) => ({
        client_id: c.id,
        activity_type: 'sms_opt_in',
        activity_data: { from_e164: fromE164, source: 'sms_reply' },
      })),
    );
    return matchedClients[0].name ?? null;
  }

  // No client match — try a lead name so the reply can still greet them.
  const { data: matchedLeads } = await supabase
    .from('leads')
    .select('name')
    .in('phone', variants)
    .limit(1);
  return matchedLeads?.[0]?.name ?? null;
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
