/**
 * Outbound SMS opt-in requests (the double-opt-in front door).
 *
 * When we want to text a contact who has NO consent on file, we don't send
 * them the real message — we send a friendly "reply YES to opt in" request
 * first. Their YES (handled by the inbound webhook) becomes the consent, and
 * future messages flow normally.
 *
 * This helper centralizes that send so every caller (invoice SMS today,
 * anything else later) gets the same copy, idempotency, and audit logging.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhoneE164 } from '@/lib/sms';
import { sendTrackedSms } from '@/lib/smsOutbox';
import { buildOptInRequestSms } from '@/lib/smsWelcome';

export type RequestSmsConsentResult =
  | { ok: true; to: string; alreadyRequested?: boolean }
  | { ok: false; status: number; error: string };

export interface RequestSmsConsentInput {
  /** Target phone (any common US format). */
  to: string | null | undefined;
  /** Client name for the greeting. */
  clientName?: string | null;
  /** Client id for activity logging (null when texting a non-client). */
  clientId?: string | null;
}

/**
 * Send the one-time "can we text you?" request. Idempotent: if we already
 * asked this client in the last 24h, we skip the resend (so re-clicking
 * "send" doesn't spam them) and report it as already-requested.
 */
export async function requestSmsConsent(
  input: RequestSmsConsentInput
): Promise<RequestSmsConsentResult> {
  const phoneE164 = normalizePhoneE164((input.to ?? '').trim());
  if (!phoneE164) {
    return {
      ok: false,
      status: 400,
      error: `Couldn't parse phone number: "${input.to ?? ''}". Use a US format like (405) 555-1234.`,
    };
  }

  const supabase = supabaseAdmin();

  // Idempotency: don't re-ask the same client within 24h.
  if (input.clientId) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('client_activity_log')
      .select('id, activity_data')
      .eq('client_id', input.clientId)
      .eq('activity_type', 'sms_optin_requested')
      .gte('created_at', oneDayAgo)
      .limit(20);
    type Row = { id: string; activity_data?: { to?: string } | null };
    if ((recent as Row[] | null)?.some((r) => r.activity_data?.to === phoneE164)) {
      return { ok: true, to: phoneE164, alreadyRequested: true };
    }
  }

  const result = await sendTrackedSms({
    to: phoneE164,
    body: buildOptInRequestSms({ name: input.clientName }),
  });
  if (!result.ok) {
    return { ok: false, status: 500, error: result.error || 'Failed to send opt-in request' };
  }

  // Audit trail — don't fail the request if logging errors.
  if (input.clientId) {
    await supabase
      .from('client_activity_log')
      .insert({
        client_id: input.clientId,
        activity_type: 'sms_optin_requested',
        activity_data: { to: phoneE164, sid: result.sid },
      })
      .then(({ error }) => {
        if (error) console.warn('[sms-consent] optin_requested log failed', error);
      });
  }

  return { ok: true, to: phoneE164 };
}

/**
 * Decide what an operator-initiated SMS (inbox composer / reply) should do.
 *
 * Policy (owner decision): the owner texts their own clients directly, so we
 * no longer require an affirmative opt-in before sending. The ONLY hard stop
 * is an explicit opt-out — honoring STOP is mandatory under carrier/CTIA rules
 * regardless of consent. Quiet hours are still enforced at the send layer.
 *
 *   - opted out → 'block'  (replied STOP; never message them again)
 *   - otherwise → 'send'
 *
 * Pure + exported so the rule is unit-tested independently of the route.
 */
export type ComposerSmsAction = 'block' | 'send';

export function decideComposerSmsAction(state: {
  consented: boolean;
  optedOut: boolean;
  hasInbound: boolean;
}): ComposerSmsAction {
  if (state.optedOut) return 'block';
  return 'send';
}

export interface SmsConsentLookup {
  clientId: string | null;
  name: string | null;
  consented: boolean;
  optedOut: boolean;
  found: boolean;
}

interface ConsentRow {
  id: string;
  name: string | null;
  phone: string | null;
  sms_consent: boolean | null;
  sms_opted_out_at: string | null;
}

/**
 * Find a contact's SMS consent state by phone, matching on the normalized
 * (E.164) form so a client stored as "(503) 710-7584" matches a "+15037107584"
 * lookup. Clients win over leads. The owner's contact list is small, so loading
 * it and matching in memory is cheaper and more reliable than format-guessing
 * a SQL `IN (...)`.
 */
export async function lookupSmsConsentByPhone(phone: string): Promise<SmsConsentLookup> {
  const none: SmsConsentLookup = {
    clientId: null,
    name: null,
    consented: false,
    optedOut: false,
    found: false,
  };
  const target = normalizePhoneE164(phone);
  if (!target) return none;

  const supabase = supabaseAdmin();
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, phone, sms_consent, sms_opted_out_at');
  for (const c of (clients ?? []) as unknown as ConsentRow[]) {
    if (c.phone && normalizePhoneE164(c.phone) === target) {
      return {
        clientId: c.id,
        name: c.name,
        consented: !!c.sms_consent,
        optedOut: !!c.sms_opted_out_at,
        found: true,
      };
    }
  }

  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, phone, sms_consent, sms_opted_out_at');
  for (const l of (leads ?? []) as unknown as ConsentRow[]) {
    if (l.phone && normalizePhoneE164(l.phone) === target) {
      return {
        clientId: null,
        name: l.name,
        consented: !!l.sms_consent,
        optedOut: !!l.sms_opted_out_at,
        found: true,
      };
    }
  }

  return none;
}
