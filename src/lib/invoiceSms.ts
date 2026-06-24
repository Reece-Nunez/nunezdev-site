/**
 * Higher-level "send this invoice link via SMS" helper, used by:
 *   - /api/invoices/[id]/send-sms (one-off send button)
 *   - /api/invoices/combine      (when admin picks SMS as a delivery method)
 *
 * Wraps the raw Twilio send (sms.ts) with the abuse-prevention guards we
 * want for every invoice-related SMS: phone normalization, content guard,
 * idempotency, per-invoice rate limit, per-org daily cap, audit logging.
 *
 * Centralizing it here so the limits stay consistent no matter where the
 * SMS is triggered from.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhoneE164 } from '@/lib/sms';
import { sendTrackedSms } from '@/lib/smsOutbox';
import { buildInvoiceShareMessage } from '@/lib/invoiceShareMessage';

export type SendInvoiceSmsResult =
  | { ok: true; sid?: string; to: string; messageLength: number }
  | { ok: false; status: number; error: string };

export interface SendInvoiceSmsInput {
  invoiceId: string;
  orgId: string;
  /** Phone number (any common US format). Falls back to clientPhoneOnFile. */
  to?: string | null;
  /** Phone on the client record — used as fallback when `to` is missing. */
  clientPhoneOnFile?: string | null;
  /** Custom message; if absent, a default is built. */
  bodyOverride?: string | null;
  /** Client name for the default message greeting. */
  clientName: string | null;
  /** Client id for activity logging. */
  clientId: string | null;
  /** Invoice number for the default message + log metadata. */
  invoiceNumber: string | null;
  /** Total amount in cents for the default message. */
  amountCents: number;
  /** The invoice's public access_token (used to build the URL the SMS links to). */
  accessToken: string | null;
}

// Default message body — centralized in src/lib/invoiceShareMessage so all
// channels (SMS modal, Share Link, combine post-share) stay in lockstep.
function defaultMessage(name: string | null, amountCents: number, url: string): string {
  return buildInvoiceShareMessage({ clientName: name, amountCents, url });
}

/**
 * Send a branded invoice SMS subject to all our standard guards.
 * Logs every send (success or skipped) to `client_activity_log` for audit.
 */
export async function sendInvoiceSmsWithGuards(
  input: SendInvoiceSmsInput
): Promise<SendInvoiceSmsResult> {
  const supabase = supabaseAdmin();

  if (!input.accessToken) {
    return { ok: false, status: 400, error: 'Invoice has no public link — cannot share via SMS' };
  }

  // Resolve target phone — explicit `to` overrides the client's stored phone
  const rawPhone = (input.to ?? input.clientPhoneOnFile ?? '').trim();
  if (!rawPhone) {
    return {
      ok: false,
      status: 400,
      error:
        'No phone number provided and no phone on file for this client. Add one or specify the recipient.',
    };
  }
  const phoneE164 = normalizePhoneE164(rawPhone);
  if (!phoneE164) {
    return {
      ok: false,
      status: 400,
      error: `Couldn't parse phone number: "${rawPhone}". Use a US format like (405) 555-1234.`,
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
  const invoiceUrl = `${baseUrl}/invoice/${input.accessToken}`;

  const message = (input.bodyOverride?.trim()) || defaultMessage(input.clientName, input.amountCents, invoiceUrl);

  // Hard length cap (5 Twilio segments)
  if (message.length > 800) {
    return { ok: false, status: 400, error: 'Message too long (max 800 characters)' };
  }

  // Content guard: every message MUST include the invoice link. Prevents
  // misuse as a general SMS gateway via our Twilio number.
  if (!message.includes(input.accessToken)) {
    return { ok: false, status: 400, error: 'Message must include the invoice link.' };
  }

  // -------- Rate limits backed by client_activity_log -------------------
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // (a) Idempotency: same invoice + same number in last 60s = dupe
  const { data: recentDupes } = await supabase
    .from('client_activity_log')
    .select('id, activity_data')
    .eq('invoice_id', input.invoiceId)
    .eq('activity_type', 'invoice_sms_sent')
    .gte('created_at', oneMinuteAgo)
    .limit(20);
  type SmsLogRow = { id: string; activity_data?: { to?: string } | null };
  if (
    (recentDupes as SmsLogRow[] | null)?.some(
      (r) => r.activity_data?.to === phoneE164
    )
  ) {
    return {
      ok: false,
      status: 429,
      error:
        'A text for this invoice was just sent to the same number. Wait a minute before retrying.',
    };
  }

  // (b) Per-invoice cap: max 5 SMS to ANY destination in the last hour
  const { count: hourlyCount } = await supabase
    .from('client_activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', input.invoiceId)
    .eq('activity_type', 'invoice_sms_sent')
    .gte('created_at', oneHourAgo);
  if ((hourlyCount ?? 0) >= 5) {
    return {
      ok: false,
      status: 429,
      error: 'Too many texts sent for this invoice in the last hour (max 5). Please wait.',
    };
  }

  // (c) Org-wide daily cap: catches runaway loops / compromised sessions
  const { count: dailyCount } = await supabase
    .from('client_activity_log')
    .select('id, invoice:invoices!inner(org_id)', { count: 'exact', head: true })
    .eq('activity_type', 'invoice_sms_sent')
    .eq('invoice.org_id', input.orgId)
    .gte('created_at', oneDayAgo);
  if ((dailyCount ?? 0) >= 50) {
    return {
      ok: false,
      status: 429,
      error:
        'Daily SMS limit reached (50 messages in 24h). This is a safety cap — contact support if you need a higher limit.',
    };
  }

  // -------- Send + log ---------------------------------------------------
  // sendTrackedSms also mirrors the invoice text into the inbox thread.
  const result = await sendTrackedSms({ to: phoneE164, body: message });
  if (!result.ok) {
    // Record the failure too. Previously only successes were logged, so a
    // send that failed at Twilio (e.g. A2P 10DLC filtering, bad number,
    // balance) left NO trace — making "I texted it but they never got it"
    // impossible to diagnose after the fact. Best-effort insert.
    await supabase
      .from('client_activity_log')
      .insert({
        invoice_id: input.invoiceId,
        client_id: input.clientId,
        activity_type: 'invoice_sms_failed',
        activity_data: {
          invoice_number: input.invoiceNumber,
          to: phoneE164,
          error: result.error ?? 'unknown',
        },
      })
      .then(({ error: logErr }) => {
        if (logErr) console.warn('[invoice-sms] failure log failed', logErr);
      });
    return { ok: false, status: 500, error: result.error || 'Failed to send SMS' };
  }

  // Activity log (audit trail). Don't fail the request if this insert errors.
  await supabase
    .from('client_activity_log')
    .insert({
      invoice_id: input.invoiceId,
      client_id: input.clientId,
      activity_type: 'invoice_sms_sent',
      activity_data: {
        invoice_number: input.invoiceNumber,
        to: phoneE164,
        sid: result.sid,
        message_length: message.length,
      },
    })
    .then(({ error: logErr }) => {
      if (logErr) console.warn('[invoice-sms] activity log failed', logErr);
    });

  return { ok: true, sid: result.sid, to: phoneE164, messageLength: message.length };
}
