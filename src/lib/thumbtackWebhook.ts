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

// ── Payload field extraction ─────────────────────────────────────────────
// The indexed columns we pull out of a Thumbtack delivery. The full payload is
// always stored raw; these just make events queryable + dedup-able.
export interface ParsedThumbtackEvent {
  eventType: string | null;
  externalId: string | null;
  businessId: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Coerce a scalar id/name to a trimmed string; anything else (object/array/
// nullish) -> null. Guards against the "[object Object]" bug from blindly
// String()-ing a nested object.
function asStr(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * Pull the indexed fields out of a real Thumbtack webhook payload.
 *
 * Shape (confirmed from a live NegotiationCreatedV4 delivery): the event kind
 * is at `event.eventType`, and the per-event identity + business live under
 * `data` (`data.negotiationID`, `data.business.businessID`). We fall back
 * through other plausible id fields so message/review events (shapes not yet
 * observed) still get a dedup key where one exists, and degrade to null rather
 * than throwing on anything unexpected.
 */
export function parseThumbtackEvent(payload: unknown): ParsedThumbtackEvent {
  const root = isRecord(payload) ? payload : {};
  const event = isRecord(root.event) ? root.event : {};
  const data = isRecord(root.data) ? root.data : {};
  const business = isRecord(data.business) ? data.business : {};
  const request = isRecord(data.request) ? data.request : {};

  const eventType =
    asStr(event.eventType) ?? asStr(root.event_type) ?? asStr(root.type);

  // Durable per-event id for idempotency. negotiationID identifies a
  // lead/negotiation; the others cover other event kinds we haven't seen yet.
  const externalId =
    asStr(data.negotiationID) ??
    asStr(data.reviewID) ??
    asStr(data.messageID) ??
    asStr(request.requestID) ??
    asStr(root.id);

  const businessId = asStr(business.businessID) ?? asStr(root.business_id);

  return { eventType, externalId, businessId };
}
