/**
 * SMS sending via Twilio.
 *
 * Auth (env vars — pick one path):
 *   1. Auth Token (simpler):
 *      TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *   2. API Key (rotatable, recommended for production):
 *      TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_ACCOUNT_SID, TWILIO_PHONE_NUMBER
 *
 * Detection: if TWILIO_API_KEY_SECRET is set we use the API key path; else
 * we fall back to Auth Token. Both require TWILIO_ACCOUNT_SID and
 * TWILIO_PHONE_NUMBER (the "from" number).
 */
import { Twilio } from 'twilio';

export interface SmsSendResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

function getTwilioClient(): Twilio | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  if (!accountSid) return null;

  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  if (apiKeySecret && apiKeySid) {
    return new Twilio(apiKeySid, apiKeySecret, { accountSid });
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    return new Twilio(accountSid, authToken);
  }

  return null;
}

/**
 * Normalize a US phone number to E.164 (+1XXXXXXXXXX).
 *
 * This deliberately rejects non-US numbers — Twilio international SMS costs
 * 5-50x more per message, and our use case is US-only. Update the validation
 * here when we have a real international need (and verify A2P 10DLC and
 * carrier registration accordingly).
 *
 * Accepts: (405) 555-1234, 405-555-1234, 4055551234, 1-405-555-1234,
 *          +1 405 555 1234, +14055551234.
 * Returns null on anything that can't confidently produce a US E.164.
 */
export function normalizePhoneE164(input: string): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  // 10 digits → US, prepend +1
  if (digits.length === 10) return `+1${digits}`;
  // 11 digits starting with 1 → US with country code
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  // Anything else (international, malformed, etc.) — reject
  return null;
}

/**
 * Send an SMS. Returns { ok, sid } on success, { ok: false, error } on failure.
 * Does NOT throw — caller decides how to surface errors.
 */
export async function sendSms(params: {
  to: string;
  body: string;
}): Promise<SmsSendResult> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !from) {
    const missing: string[] = [];
    if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
    if (
      !process.env.TWILIO_AUTH_TOKEN &&
      !(process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET)
    ) {
      missing.push('TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET');
    }
    if (!from) missing.push('TWILIO_PHONE_NUMBER');
    return {
      ok: false,
      error: `Twilio not configured. Missing env: ${missing.join(', ')}`,
    };
  }

  const to = normalizePhoneE164(params.to);
  if (!to) {
    return { ok: false, error: `Invalid phone number: ${params.to}` };
  }

  try {
    const message = await client.messages.create({
      to,
      from,
      body: params.body,
    });
    return { ok: true, sid: message.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sms] Twilio send failed', { to, error: msg });
    return { ok: false, error: msg };
  }
}
