/**
 * Twilio webhook signature verification.
 *
 * Twilio signs every webhook with HMAC-SHA1 of (full URL + sorted form
 * params) keyed by the account auth token. Verifying this rejects anyone
 * spoofing the endpoint — without it, anyone on the internet could POST
 * forged "voicemail recorded" callbacks at us.
 *
 * Uses Twilio's own validateRequest helper. The URL passed in MUST be the
 * exact URL Twilio called, including protocol, host, path, and any query
 * string — any deviation invalidates the signature.
 */
import { validateRequest } from 'twilio';
import type { NextRequest } from 'next/server';

interface VerifyResult {
  ok: boolean;
  params: Record<string, string>;
  /** Human-readable reason set when ok=false. Safe to log; never includes the signature. */
  reason?: string;
}

/**
 * Read the request body as form params, verify Twilio's signature, and
 * return the parsed params. The body is consumed — callers should use the
 * returned `params` object instead of re-reading the request.
 *
 * Bypass: if TWILIO_WEBHOOK_SKIP_VERIFY=1 (e.g. local dev hitting via
 * curl), we parse params and skip verification. Never enable in prod.
 */
export async function verifyTwilioWebhook(
  request: NextRequest,
): Promise<VerifyResult> {
  // Twilio webhooks are application/x-www-form-urlencoded. Parse to a
  // plain Record<string,string> — validateRequest expects that shape.
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    // Files would be `File` objects; Twilio webhooks never send files,
    // and validateRequest can't handle them anyway.
    if (typeof value === 'string') params[key] = value;
  });

  if (process.env.TWILIO_WEBHOOK_SKIP_VERIFY === '1') {
    return { ok: true, params };
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return { ok: false, params, reason: 'TWILIO_AUTH_TOKEN not configured' };
  }

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) {
    return { ok: false, params, reason: 'missing X-Twilio-Signature header' };
  }

  // Twilio computes the signature against the URL it called. Behind
  // Vercel / Cloudflare we don't always get the right host from
  // request.url, so prefer the forwarded host header when present and
  // fall back to request.url. The protocol is always https in prod.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const url = forwardedHost
    ? `${forwardedProto}://${forwardedHost}${new URL(request.url).pathname}${new URL(request.url).search}`
    : request.url;

  const ok = validateRequest(authToken, signature, url, params);
  return ok
    ? { ok: true, params }
    : { ok: false, params, reason: 'invalid Twilio signature' };
}
