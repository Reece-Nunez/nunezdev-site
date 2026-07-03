/**
 * "Send this proposal link via SMS" helper, used by /api/proposals/[id]/send
 * when the operator picks Text or Both.
 *
 * Mirrors the guards in invoiceSms.ts that actually matter for a proposal text:
 * honor STOP opt-outs (carrier/CTIA requirement), normalize the phone, cap the
 * length, and require the proposal link in the body so our Twilio number can't
 * be used as a general SMS gateway. The send itself goes through sendTrackedSms
 * so every proposal text (success or failure) lands in the dashboard inbox as a
 * complete two-way history — that is the audit trail, so we don't duplicate it
 * into client_activity_log (whose activity_type CHECK is invoice-scoped anyway).
 */
import { normalizePhoneE164 } from '@/lib/sms';
import { sendTrackedSms } from '@/lib/smsOutbox';
import { buildProposalShareMessage } from '@/lib/proposalShareMessage';

export type SendProposalSmsResult =
  | { ok: true; sid?: string; to: string; messageLength: number }
  | { ok: false; status: number; error: string };

export interface SendProposalSmsInput {
  /** Phone number (any common US format). Falls back to clientPhoneOnFile. */
  to?: string | null;
  /** Phone on the client record — used as fallback when `to` is missing. */
  clientPhoneOnFile?: string | null;
  /** Set when the client replied STOP. Non-null blocks the send. */
  clientOptedOutAt?: string | null;
  /** Custom message; if absent, a default is built. */
  bodyOverride?: string | null;
  clientName: string | null;
  proposalTitle: string | null;
  amountCents: number;
  /** The proposal's public access_token (used to build the link the SMS points to). */
  accessToken: string | null;
  /** Operator user id for inbox attribution. */
  sentBy?: string | null;
}

/** Build the public proposal URL for a given access token. */
export function proposalUrl(accessToken: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
  return `${baseUrl}/proposal/${accessToken}`;
}

export async function sendProposalSmsWithGuards(
  input: SendProposalSmsInput
): Promise<SendProposalSmsResult> {
  if (!input.accessToken) {
    return { ok: false, status: 400, error: 'Proposal has no public link — cannot share via text.' };
  }

  // Honor opt-out (STOP). Consent-to-opt-in is not required (owner policy,
  // matching invoices), but a client who replied STOP must never be texted.
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

  const url = proposalUrl(input.accessToken);
  const message =
    input.bodyOverride?.trim() ||
    buildProposalShareMessage({
      clientName: input.clientName,
      proposalTitle: input.proposalTitle,
      amountCents: input.amountCents,
      url,
    });

  // Hard length cap (5 Twilio segments), same as invoices.
  if (message.length > 800) {
    return { ok: false, status: 400, error: 'Message too long (max 800 characters).' };
  }

  // Content guard: the message MUST include the proposal link.
  if (!message.includes(input.accessToken)) {
    return { ok: false, status: 400, error: 'Message must include the proposal link.' };
  }

  const result = await sendTrackedSms({ to: phoneE164, body: message, sentBy: input.sentBy ?? null });
  if (!result.ok) {
    return { ok: false, status: 500, error: result.error || 'Failed to send text.' };
  }
  return { ok: true, sid: result.sid, to: phoneE164, messageLength: message.length };
}
