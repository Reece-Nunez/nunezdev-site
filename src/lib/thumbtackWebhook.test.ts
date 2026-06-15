/**
 * Unit tests for the Thumbtack webhook secret verification. Run with:
 *
 *   npm test
 *
 * No DB, no network. These pin the security contract for a PUBLIC endpoint:
 * only a request carrying the exact configured secret is accepted, and any
 * misconfiguration fails closed (rejects) rather than open.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyWebhookSecret, parseThumbtackEvent } from './thumbtackWebhook';

const SECRET = 'dbc179b2d0bdccbcb502db060647becc50db99c1607c3429f3fe77b7a9498d6a';

describe('verifyWebhookSecret', () => {
  it('accepts a bare secret (Custom Header config)', () => {
    assert.equal(verifyWebhookSecret(SECRET, SECRET), true);
  });

  it('accepts a "Bearer <secret>" header (Bearer config)', () => {
    assert.equal(verifyWebhookSecret(`Bearer ${SECRET}`, SECRET), true);
    // Bearer match is case-insensitive on the scheme token.
    assert.equal(verifyWebhookSecret(`bearer ${SECRET}`, SECRET), true);
  });

  it('rejects a wrong secret', () => {
    assert.equal(verifyWebhookSecret('not-the-secret', SECRET), false);
  });

  it('rejects a secret with a trailing/leading difference', () => {
    assert.equal(verifyWebhookSecret(`${SECRET}x`, SECRET), false);
    assert.equal(verifyWebhookSecret(SECRET.slice(0, -1), SECRET), false);
  });

  it('rejects an empty / missing header', () => {
    assert.equal(verifyWebhookSecret('', SECRET), false);
    assert.equal(verifyWebhookSecret(null, SECRET), false);
    assert.equal(verifyWebhookSecret(undefined, SECRET), false);
    assert.equal(verifyWebhookSecret('Bearer ', SECRET), false);
  });

  it('fails closed when no secret is configured', () => {
    // A deploy that forgot THUMBTACK_WEBHOOK_SECRET must reject everything,
    // never accept all callers.
    assert.equal(verifyWebhookSecret(SECRET, undefined), false);
    assert.equal(verifyWebhookSecret(SECRET, ''), false);
    assert.equal(verifyWebhookSecret('', undefined), false);
  });
});

// Trimmed from a real NegotiationCreatedV4 test delivery (2026-06-15).
const REAL_LEAD_EVENT = {
  data: {
    status: 'Open',
    request: { requestID: '582419362778267654', customerID: '582419362773041165' },
    business: { name: 'Test Business for Webhooks', businessID: '553306875926847497' },
    customer: { firstName: 'Test', lastName: 'Customer', phone: '1234567890' },
    estimate: { type: 'Fixed', total: '$150.00' },
    leadPrice: '$25.00',
    negotiationID: '582419362774474767',
    createdAt: '2026-06-15T23:09:22Z',
  },
  event: { eventType: 'NegotiationCreatedV4', webhookID: '582415950855946243' },
};

describe('parseThumbtackEvent', () => {
  it('extracts eventType / negotiationID / businessID from a real lead event', () => {
    assert.deepEqual(parseThumbtackEvent(REAL_LEAD_EVENT), {
      eventType: 'NegotiationCreatedV4',
      externalId: '582419362774474767', // data.negotiationID — the dedup key
      businessId: '553306875926847497',
    });
  });

  it('does NOT stringify a nested object (regression: event_type was "[object Object]")', () => {
    const parsed = parseThumbtackEvent(REAL_LEAD_EVENT);
    assert.notEqual(parsed.eventType, '[object Object]');
    assert.equal(typeof parsed.eventType, 'string');
  });

  it('falls back to requestID when negotiationID is absent', () => {
    const payload = { event: { eventType: 'X' }, data: { request: { requestID: 'r1' } } };
    assert.equal(parseThumbtackEvent(payload).externalId, 'r1');
  });

  it('degrades to all-null on empty / malformed payloads (never throws)', () => {
    assert.deepEqual(parseThumbtackEvent({}), {
      eventType: null,
      externalId: null,
      businessId: null,
    });
    assert.deepEqual(parseThumbtackEvent(null), {
      eventType: null,
      externalId: null,
      businessId: null,
    });
    assert.deepEqual(parseThumbtackEvent('not-json'), {
      eventType: null,
      externalId: null,
      businessId: null,
    });
  });
});
