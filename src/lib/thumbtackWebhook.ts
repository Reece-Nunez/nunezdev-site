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

// A lead's structured Q&A lives in request.details[] as {question, answer}
// pairs (e.g. {question:"Budget", answer:"$1,000 - $1,500"}). Look up the
// answer for the first matching question label (case-insensitive). Defensive:
// a non-array or missing label -> null rather than throwing.
function findDetailAnswer(details: unknown, ...labels: string[]): string | null {
  if (!Array.isArray(details)) return null;
  const want = labels.map((l) => l.toLowerCase());
  for (const item of details) {
    if (!isRecord(item)) continue;
    const q = asStr(item.question);
    if (q && want.includes(q.toLowerCase())) return asStr(item.answer);
  }
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

// ── Lead-detail extraction (Phase A: webhook -> expense) ─────────────────

// Thumbtack lead event kinds that represent a new lead we should record as a
// lead-fee expense. NegotiationCreatedV4 is the one confirmed from a live
// delivery; extend as new lead event types surface.
const LEAD_EVENT_TYPES = new Set(['NegotiationCreatedV4']);

export function isThumbtackLeadEvent(eventType: string | null | undefined): boolean {
  return !!eventType && LEAD_EVENT_TYPES.has(eventType);
}

const MESSAGE_EVENT_TYPES = new Set(['MessageCreatedV4']);

export function isThumbtackMessageEvent(eventType: string | null | undefined): boolean {
  return !!eventType && MESSAGE_EVENT_TYPES.has(eventType);
}

/**
 * Parse a Thumbtack money string ("$25.00", "$1,234.56") or number to integer
 * cents — the storage unit for expenses.amount_cents. Returns null on anything
 * unparseable so callers can skip rather than store a bogus 0.
 */
export function parseDollarsToCents(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.round(input * 100);
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export interface ThumbtackLeadDetails {
  negotiationID: string | null;
  businessId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  leadPriceCents: number | null;
  category: string | null;
  description: string | null;
  budget: string | null;   // from the "Budget" Q&A in request.details[]
  timeline: string | null; // from the "Deadline" Q&A in request.details[]
  status: string | null;
  createdAtDate: string | null; // YYYY-MM-DD (date portion of data.createdAt)
}

/**
 * Pull the human-meaningful lead fields out of a lead event payload. Used to
 * build the expense row and to render the Thumbtack leads view. Defensive:
 * every field degrades to null rather than throwing on an unexpected shape.
 */
export function extractLeadDetails(payload: unknown): ThumbtackLeadDetails {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : {};
  const business = isRecord(data.business) ? data.business : {};
  const customer = isRecord(data.customer) ? data.customer : {};
  const request = isRecord(data.request) ? data.request : {};
  const category = isRecord(request.category) ? request.category : {};

  const first = asStr(customer.firstName);
  const last = asStr(customer.lastName);
  const customerName = [first, last].filter(Boolean).join(' ') || null;

  const createdAt = asStr(data.createdAt);
  const createdAtDate = createdAt ? createdAt.slice(0, 10) : null;

  return {
    negotiationID: asStr(data.negotiationID),
    businessId: asStr(business.businessID),
    customerName,
    customerPhone: asStr(customer.phone),
    leadPriceCents: parseDollarsToCents(data.leadPrice),
    category: asStr(category.name),
    description: asStr(request.description),
    budget: findDetailAnswer(request.details, 'Budget'),
    timeline: findDetailAnswer(request.details, 'Deadline', 'Timeline'),
    status: asStr(data.status),
    createdAtDate,
  };
}

// ── Lead-pipeline mapping (Phase D: webhook -> leads) ────────────────────

/** The leads-table columns we set from a Thumbtack lead event. */
export interface ThumbtackLeadInsert {
  name: string | null;
  phone: string | null;
  project_type: string | null;
  budget: string | null;
  timeline: string | null;
  message: string | null;
  source: 'thumbtack';
  lead_source: 'Thumbtack';
  status: 'new';
  thumbtack_negotiation_id: string | null;
}

/**
 * Map a parsed lead event onto the leads-table shape. Pure: phone is passed
 * through verbatim (the DB layer normalizes to E.164), status is always 'new'
 * for a fresh capture, and source marks it as Thumbtack-originated for ROI.
 */
export function buildThumbtackLeadInsert(details: ThumbtackLeadDetails): ThumbtackLeadInsert {
  return {
    name: details.customerName,
    phone: details.customerPhone,
    project_type: details.category,
    budget: details.budget,
    timeline: details.timeline,
    message: details.description,
    source: 'thumbtack',
    lead_source: 'Thumbtack',
    status: 'new',
    thumbtack_negotiation_id: details.negotiationID,
  };
}

// ── Message extraction (Phase C: webhook -> inbox) ───────────────────────

export interface ThumbtackMessage {
  negotiationID: string | null; // the thread key (one conversation per negotiation)
  messageID: string | null;     // dedup key
  businessName: string | null;
  customerExternalId: string | null;
  customerName: string | null;
  direction: 'inbound' | 'outbound';
  text: string | null;
  sentAt: string | null;
}

/**
 * Parse a Thumbtack message event (MessageCreatedV4). Shape confirmed from a
 * live delivery: body at `data.text`, sender role at `data.from` ("Business"
 * = we sent it -> outbound; "Customer" = they sent it -> inbound), and the
 * thread is `data.negotiationID`. Messages carry NO email/phone — only display
 * names + ids — so conversations key on negotiationID, not a contact handle.
 */
export function extractThumbtackMessage(payload: unknown): ThumbtackMessage {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : {};
  const business = isRecord(data.business) ? data.business : {};
  const customer = isRecord(data.customer) ? data.customer : {};

  const fromRole = asStr(data.from);
  const direction: 'inbound' | 'outbound' =
    fromRole && /customer/i.test(fromRole) ? 'inbound' : 'outbound';

  return {
    negotiationID: asStr(data.negotiationID),
    messageID: asStr(data.messageID),
    businessName: asStr(business.displayName),
    customerExternalId: asStr(customer.customerID),
    customerName: asStr(customer.displayName),
    direction,
    text: asStr(data.text),
    sentAt: asStr(data.sentAt),
  };
}
