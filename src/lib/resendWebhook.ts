/**
 * Resend webhook signature verification (Svix scheme).
 *
 * Resend signs webhooks with Svix. The installed Resend SDK (6.0.1) doesn't
 * expose webhooks.verify(), so we implement the documented scheme directly —
 * no SDK bump on the production email path, no extra dependency.
 *
 * Scheme: HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`, keyed by the
 * base64-decoded secret (the part after the `whsec_` prefix). The
 * svix-signature header is a space-delimited list of `v<version>,<base64sig>`
 * tokens; a match on any v1 token passes. We also enforce a timestamp window
 * to blunt replay.
 *
 * Pure + alias-free so it unit-tests under the tsx runner.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export interface ResendWebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

// Svix's own tolerance is 5 minutes either side.
const TOLERANCE_SECONDS = 5 * 60;

export function verifyResendWebhook(params: {
  payload: string;
  headers: ResendWebhookHeaders;
  secret: string;
  /** Injectable clock (seconds) for deterministic tests. */
  nowSeconds?: number;
}): { ok: boolean; reason?: string } {
  const { payload, headers, secret } = params;

  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { ok: false, reason: 'missing svix headers' };
  }
  if (!secret) {
    return { ok: false, reason: 'no webhook secret configured' };
  }

  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'invalid timestamp' };
  }
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside tolerance' };
  }

  // Secret is `whsec_<base64>`; the signing key is the decoded base64.
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${headers.id}.${headers.timestamp}.${payload}`;
  const expected = createHmac('sha256', key).update(signedContent).digest('base64');
  const expectedBuf = Buffer.from(expected);

  // Header: "v1,<sig> v1,<sig2> ..." — pass if any token matches.
  const passed = headers.signature.split(' ').some((token) => {
    const comma = token.indexOf(',');
    if (comma === -1) return false;
    const sig = token.slice(comma + 1);
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });

  return passed ? { ok: true } : { ok: false, reason: 'no matching signature' };
}
