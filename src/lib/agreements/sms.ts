/**
 * SERVER-ONLY: "share this agreement link via SMS" helper, used by
 * /api/agreements/[id]/send. Pulls in Twilio (via smsOutbox) and phone
 * normalization, so it must never be imported from a client component — the
 * pure helpers live in ./share.ts.
 *
 * Guards mirror proposalSms.ts: honor STOP opt-outs (CTIA), normalize the phone,
 * cap the length, and require the agreement link in the body so our Twilio
 * number can't be used as a general SMS gateway. The send goes through
 * sendTrackedSms so every text lands in the dashboard inbox as an audit trail.
 */
import { normalizePhoneE164 } from '@/lib/sms';
import { sendTrackedSms } from '@/lib/smsOutbox';
import { agreementUrl, buildAgreementShareMessage } from '@/lib/agreements/share';

export type SendAgreementSmsResult =
  | { ok: true; sid?: string; to: string; messageLength: number }
  | { ok: false; status: number; error: string };

export interface SendAgreementSmsInput {
  to?: string | null;
  clientPhoneOnFile?: string | null;
  clientOptedOutAt?: string | null;
  bodyOverride?: string | null;
  clientName: string | null;
  title: string | null;
  accessToken: string | null;
  sentBy?: string | null;
}

export async function sendAgreementSmsWithGuards(
  input: SendAgreementSmsInput,
): Promise<SendAgreementSmsResult> {
  if (!input.accessToken) {
    return { ok: false, status: 400, error: 'Agreement has no public link — cannot share via text.' };
  }

  // Honor STOP opt-outs (CTIA requirement). A client who replied STOP is never texted.
  if (input.clientOptedOutAt) {
    return {
      ok: false,
      status: 409,
      error: 'This client opted out of texts (replied STOP). Reach them by email instead.',
    };
  }

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

  const url = agreementUrl(input.accessToken);
  const message =
    input.bodyOverride?.trim() ||
    buildAgreementShareMessage({ clientName: input.clientName, title: input.title, url });

  if (message.length > 800) {
    return { ok: false, status: 400, error: 'Message too long (max 800 characters).' };
  }

  // Content guard: the message MUST include the agreement link.
  if (!message.includes(input.accessToken)) {
    return { ok: false, status: 400, error: 'Message must include the agreement link.' };
  }

  const result = await sendTrackedSms({ to: phoneE164, body: message, sentBy: input.sentBy ?? null });
  if (!result.ok) {
    return { ok: false, status: 500, error: result.error || 'Failed to send text.' };
  }
  return { ok: true, sid: result.sid, to: phoneE164, messageLength: message.length };
}
