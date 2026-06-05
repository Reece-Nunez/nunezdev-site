/**
 * Outbound voice calls via Twilio. Twin of @/lib/sms — same env-var
 * resolution and US-only E.164 normalization.
 *
 * Twilio's POST /Calls.json requires either `Url` (TwiML hosted on a
 * URL) or `Twiml` (raw TwiML inline). We expose both:
 *
 *   sendVoice({ to, twimlUrl: 'https://example.com/twiml' })
 *   sendVoice({ to, twiml: '<Response><Say>Hi</Say></Response>' })
 *   sendVoice({ to, sayText: 'Your invoice is due tomorrow.' })  // shortcut
 *
 * The `sayText` shortcut wraps the text in a minimal <Response><Say>
 * envelope, which is the 99% case for transactional voice (reminders,
 * confirmations). For anything richer (gather digits, dial bridge, etc.)
 * pass `twiml` or `twimlUrl`.
 */
import { Twilio } from 'twilio';
import { normalizePhoneE164 } from '@/lib/sms';

export interface VoiceSendResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

interface VoiceSendBase {
  to: string;
}
interface VoiceSendWithUrl extends VoiceSendBase {
  twimlUrl: string;
  twiml?: never;
  sayText?: never;
}
interface VoiceSendWithTwiml extends VoiceSendBase {
  twiml: string;
  twimlUrl?: never;
  sayText?: never;
}
interface VoiceSendWithSay extends VoiceSendBase {
  sayText: string;
  twiml?: never;
  twimlUrl?: never;
}

export type VoiceSendParams =
  | VoiceSendWithUrl
  | VoiceSendWithTwiml
  | VoiceSendWithSay;

function resolveAccountSid(): string | undefined {
  return process.env.TWILIO_ACCOUNT_SID;
}
function resolveAuthToken(): string | undefined {
  return process.env.TWILIO_AUTH_TOKEN;
}
function resolveFromNumber(): string | undefined {
  return (
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_FROM_NUMBER ||
    process.env.TWILIO_FROM ||
    process.env.TWILIO_NUMBER
  );
}

function getTwilioClient(): Twilio | null {
  const accountSid = resolveAccountSid();
  if (!accountSid) return null;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  if (apiKeySid && apiKeySecret) {
    return new Twilio(apiKeySid, apiKeySecret, { accountSid });
  }
  const authToken = resolveAuthToken();
  if (authToken) {
    return new Twilio(accountSid, authToken);
  }
  return null;
}

/**
 * Cheap escape for putting user-supplied text inside <Say>. Twilio's
 * TwiML parser is XML, so the standard five replacements are enough —
 * we don't generate attribute values from user input, so no quote
 * escaping needed.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function sendVoice(params: VoiceSendParams): Promise<VoiceSendResult> {
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

  // Build the create() args. Twilio's SDK accepts either `url` or `twiml`
  // (mutually exclusive). The discriminated union above ensures the
  // caller picked exactly one.
  let callArgs: { to: string; from: string; url?: string; twiml?: string };
  if ('twimlUrl' in params && params.twimlUrl) {
    callArgs = { to, from, url: params.twimlUrl };
  } else if ('twiml' in params && params.twiml) {
    callArgs = { to, from, twiml: params.twiml };
  } else if ('sayText' in params && params.sayText) {
    callArgs = {
      to,
      from,
      twiml: `<Response><Say voice="Polly.Joanna">${escapeXml(params.sayText)}</Say></Response>`,
    };
  } else {
    return { ok: false, error: 'sendVoice requires twimlUrl, twiml, or sayText' };
  }

  try {
    const call = await client.calls.create(callArgs);
    return { ok: true, sid: call.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice] Twilio call failed', { to, error: msg });
    return { ok: false, error: msg };
  }
}
