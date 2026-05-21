/**
 * SMS sending via Twilio.
 *
 * Env vars — supports two naming conventions, either works:
 *
 *   Convention A (canonical Twilio naming):
 *     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *
 *   Convention B (NunezDev short names):
 *     TWILIO_SID,         TWILIO_CLIENT_SECRET, TWILIO_PHONE_NUMBER
 *
 *   Optional API Key path (rotatable, preferred at scale):
 *     TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET + TWILIO_ACCOUNT_SID
 *     (or TWILIO_SID alias) + TWILIO_PHONE_NUMBER
 *
 * Detection order: API Key → Auth Token. TWILIO_PHONE_NUMBER is always
 * required — it's the "from" number Twilio sends from.
 */
import { Twilio } from 'twilio';

export interface SmsSendResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

/** Resolve the Account SID from either naming convention. */
function resolveAccountSid(): string | undefined {
  return process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
}

/** Resolve the Auth Token from either naming convention. */
function resolveAuthToken(): string | undefined {
  return process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_CLIENT_SECRET;
}

/**
 * Resolve the "from" phone number from any of the common env var names.
 * Twilio docs use TWILIO_PHONE_NUMBER, but TWILIO_FROM and TWILIO_NUMBER
 * are both common in the wild. Accept all so a non-canonical naming
 * doesn't silently disable SMS.
 */
function resolveFromNumber(): string | undefined {
  return (
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_FROM_NUMBER ||
    process.env.TWILIO_FROM ||
    process.env.TWILIO_NUMBER
  );
}

/**
 * Cheap pre-flight check: are all the env vars necessary to send an SMS
 * present? Useful when you want to fail fast before doing destructive
 * state changes (e.g., voiding invoices in the combine flow) only to
 * realize Twilio isn't wired up.
 */
export function isTwilioConfigured(): boolean {
  if (!resolveAccountSid()) return false;
  const hasApiKey = !!(process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET);
  if (!hasApiKey && !resolveAuthToken()) return false;
  if (!resolveFromNumber()) return false;
  return true;
}

/**
 * Diagnostic: report which Twilio env vars are detected WITHOUT exposing
 * their values. Used by the admin diagnostic endpoint to debug "why
 * isn't SMS working?" issues without making the user paste secrets.
 */
export function getTwilioConfigSummary(): {
  ok: boolean;
  accountSidSource: string | null;
  authSource: string | null;
  fromNumberSource: string | null;
  fromNumberHint: string | null;
} {
  const accountSidSource = process.env.TWILIO_ACCOUNT_SID
    ? 'TWILIO_ACCOUNT_SID'
    : process.env.TWILIO_SID
    ? 'TWILIO_SID'
    : null;

  const authSource = (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET)
    ? 'TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET'
    : process.env.TWILIO_AUTH_TOKEN
    ? 'TWILIO_AUTH_TOKEN'
    : process.env.TWILIO_CLIENT_SECRET
    ? 'TWILIO_CLIENT_SECRET'
    : null;

  let fromNumberSource: string | null = null;
  let fromNumberRaw: string | undefined;
  if (process.env.TWILIO_PHONE_NUMBER) {
    fromNumberSource = 'TWILIO_PHONE_NUMBER';
    fromNumberRaw = process.env.TWILIO_PHONE_NUMBER;
  } else if (process.env.TWILIO_FROM_NUMBER) {
    fromNumberSource = 'TWILIO_FROM_NUMBER';
    fromNumberRaw = process.env.TWILIO_FROM_NUMBER;
  } else if (process.env.TWILIO_FROM) {
    fromNumberSource = 'TWILIO_FROM';
    fromNumberRaw = process.env.TWILIO_FROM;
  } else if (process.env.TWILIO_NUMBER) {
    fromNumberSource = 'TWILIO_NUMBER';
    fromNumberRaw = process.env.TWILIO_NUMBER;
  }

  // Show only last 4 digits of the from number so the operator can confirm
  // they configured the right one. Never log/return the full number publicly.
  const fromNumberHint = fromNumberRaw
    ? `${fromNumberRaw.startsWith('+') ? '+' : ''}…${fromNumberRaw.replace(/\D/g, '').slice(-4)}`
    : null;

  return {
    ok: isTwilioConfigured(),
    accountSidSource,
    authSource,
    fromNumberSource,
    fromNumberHint,
  };
}

function getTwilioClient(): Twilio | null {
  const accountSid = resolveAccountSid();
  if (!accountSid) return null;

  // API Key path (recommended for production — rotatable without rotating account creds)
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  if (apiKeySecret && apiKeySid) {
    return new Twilio(apiKeySid, apiKeySecret, { accountSid });
  }

  // Auth Token path
  const authToken = resolveAuthToken();
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
  const from = resolveFromNumber();

  if (!client || !from) {
    const missing: string[] = [];
    if (!resolveAccountSid()) missing.push('TWILIO_ACCOUNT_SID (or TWILIO_SID)');
    if (
      !resolveAuthToken() &&
      !(process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET)
    ) {
      missing.push('TWILIO_AUTH_TOKEN (or TWILIO_CLIENT_SECRET)');
    }
    if (!from) missing.push('TWILIO_PHONE_NUMBER (or TWILIO_FROM_NUMBER / TWILIO_FROM / TWILIO_NUMBER)');
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
