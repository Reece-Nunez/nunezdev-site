/**
 * SMS sending via Twilio.
 *
 * Required env vars (canonical Twilio naming):
 *   TWILIO_ACCOUNT_SID    Account SID, starts with "AC..."
 *   TWILIO_AUTH_TOKEN     Auth Token paired with the Account SID
 *   TWILIO_PHONE_NUMBER   "From" number, E.164 (+1XXXXXXXXXX)
 *
 * Optional API Key path (rotatable, preferred at scale — usable instead
 * of TWILIO_AUTH_TOKEN, still requires TWILIO_ACCOUNT_SID):
 *   TWILIO_API_KEY_SID    "SK..."
 *   TWILIO_API_KEY_SECRET Secret shown once at API Key creation
 *
 * Optional Messaging Service (recommended — routes sends through the
 * Messaging Service so Twilio's Advanced Opt-Out engine sends the STOP/HELP
 * confirmation replies we can't send ourselves, since a post-STOP API send is
 * blocked with error 21610):
 *   TWILIO_MESSAGING_SERVICE_SID   "MG..."
 *
 * Detection order: API Key → Auth Token. The legacy aliases
 * TWILIO_SID / TWILIO_CLIENT_SECRET were removed because they were
 * semantically wrong (TWILIO_SID was an API Key SID being used in place
 * of the Account SID, which 401s).
 */
import { Twilio } from 'twilio';

export interface SmsSendResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

/** Resolve the Account SID. */
function resolveAccountSid(): string | undefined {
  return process.env.TWILIO_ACCOUNT_SID;
}

/** Resolve the Auth Token. */
function resolveAuthToken(): string | undefined {
  return process.env.TWILIO_AUTH_TOKEN;
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

/** Resolve the Messaging Service SID (MG...) if one is configured. */
function resolveMessagingServiceSid(): string | undefined {
  return process.env.TWILIO_MESSAGING_SERVICE_SID || undefined;
}

/**
 * Public accessor for the configured "from" number (E.164). The inbox
 * records it as the from_address on outbound SMS messages. Returns null
 * when SMS isn't configured.
 */
export function getSmsFromNumber(): string | null {
  return resolveFromNumber() ?? null;
}

/**
 * Decide the sender identity for a Twilio send. When a Messaging Service SID
 * is configured we route through it (`messagingServiceSid`) and MUST NOT also
 * pass `from` — Twilio picks the number from the service's pool, and only a
 * service-routed send lets Twilio's Advanced Opt-Out engine fire the STOP/HELP
 * confirmations. With no service SID we fall back to the bare `from` number.
 *
 * Pure + exported so the routing choice is unit-tested without hitting Twilio.
 */
export function buildMessageCreateParams(args: {
  to: string;
  body: string;
  from?: string;
  messagingServiceSid?: string;
  mediaUrl?: string[];
}):
  | { to: string; body: string; from: string; mediaUrl?: string[] }
  | { to: string; body: string; messagingServiceSid: string; mediaUrl?: string[] } {
  const { to, body, from, messagingServiceSid, mediaUrl } = args;
  // Attach mediaUrl only when there's at least one URL — an empty array turns a
  // plain SMS into a malformed MMS request that Twilio rejects. Omitting the key
  // entirely also keeps existing text-only tests/callers byte-identical.
  const media = mediaUrl && mediaUrl.length > 0 ? { mediaUrl } : {};
  if (messagingServiceSid) return { to, body, messagingServiceSid, ...media };
  return { to, body, from: from ?? '', ...media };
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
    : null;

  const authSource = (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET)
    ? 'TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET'
    : process.env.TWILIO_AUTH_TOKEN
    ? 'TWILIO_AUTH_TOKEN'
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
  /** Publicly-fetchable HTTPS URLs for MMS media. Twilio pulls each at send
   *  time, so they must stay reachable briefly (we pass short-lived presigned
   *  S3 URLs). Omit / empty for a plain text-only SMS. */
  mediaUrl?: string[];
}): Promise<SmsSendResult> {
  const client = getTwilioClient();
  const from = resolveFromNumber();

  if (!client || !from) {
    const missing: string[] = [];
    if (!resolveAccountSid()) missing.push('TWILIO_ACCOUNT_SID');
    if (
      !resolveAuthToken() &&
      !(process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET)
    ) {
      missing.push('TWILIO_AUTH_TOKEN (or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET)');
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
    const message = await client.messages.create(
      buildMessageCreateParams({
        to,
        body: params.body,
        from,
        messagingServiceSid: resolveMessagingServiceSid(),
        mediaUrl: params.mediaUrl,
      }),
    );
    return { ok: true, sid: message.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sms] Twilio send failed', { to, error: msg });
    return { ok: false, error: msg };
  }
}
