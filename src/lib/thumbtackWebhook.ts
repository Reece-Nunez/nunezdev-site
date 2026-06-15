/**
 * Pure auth helper for the Thumbtack webhook (no DB, no network — testable).
 *
 * Thumbtack's webhook form has no payload signing; instead you configure a
 * Custom Header (`Authorization`) whose value Thumbtack sends on every request.
 * We compare that value against THUMBTACK_WEBHOOK_SECRET in constant time.
 */
import crypto from 'crypto';

/** Constant-time string compare; false on any length/content mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on unequal lengths, so guard first. The early length
  // check is itself non-secret (the secret's length is not sensitive here).
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Returns true iff the request's Authorization header carries the expected
 * secret. Accepts either a bare secret or a "Bearer <secret>" form so the same
 * route works whether Thumbtack is configured with a Custom Header or a Bearer
 * scheme. Fails closed: a missing secret config or empty header is rejected.
 */
export function verifyWebhookSecret(
  authHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return false; // nothing configured -> reject (fail closed)
  const presented = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
  return presented.length > 0 && safeEqual(presented, secret);
}
