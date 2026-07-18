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
import {
  verifyWebhookSecret,
  parseThumbtackEvent,
  parseDollarsToCents,
  extractLeadDetails,
  isThumbtackLeadEvent,
  isThumbtackMessageEvent,
  extractThumbtackMessage,
  buildThumbtackLeadInsert,
} from './thumbtackWebhook';

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
    request: {
      requestID: '582419362778267654',
      customerID: '582419362773041165',
      description: 'Need Full Service Lawn Care',
      category: { name: 'Full Service Lawn Care', categoryID: '240123621172183344' },
    },
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

  // Regression: external_id carries a UNIQUE index, and negotiationID used to
  // be preferred over messageID. Because negotiationID is per-*thread*, the
  // 2nd..Nth message of a conversation collided with the 1st, was read as a
  // Thumbtack redelivery, and was dropped before being stored. Live symptom:
  // 11 MessageCreatedV4 events across 11 distinct threads — never two messages
  // in one conversation.
  it('gives two messages in the SAME thread distinct dedup keys', () => {
    const message = (messageID: string) => ({
      event: { eventType: 'MessageCreatedV4' },
      data: {
        messageID,
        negotiationID: '585197916299886599', // same thread for both
        business: { businessID: '553306875926847497' },
      },
    });

    const first = parseThumbtackEvent(message('585197916982845463'));
    const second = parseThumbtackEvent(message('585197916982845464'));

    assert.equal(first.externalId, '585197916982845463');
    assert.equal(second.externalId, '585197916982845464');
    assert.notEqual(first.externalId, second.externalId);
  });

  // A new lead fires both MessageCreatedV4 and NegotiationCreatedV4 sharing one
  // negotiationID. Whichever landed second used to be evicted, costing either
  // the opening message or the request details (category/budget/location/phone).
  it('does not collide a message event with its own negotiation event', () => {
    const messageEvent = parseThumbtackEvent({
      event: { eventType: 'MessageCreatedV4' },
      data: { messageID: 'm1', negotiationID: 'n1' },
    });
    const negotiationEvent = parseThumbtackEvent({
      event: { eventType: 'NegotiationCreatedV4' },
      data: { negotiationID: 'n1' },
    });

    assert.equal(messageEvent.externalId, 'm1');
    // NegotiationCreatedV4 has no messageID, so negotiationID stays its key.
    assert.equal(negotiationEvent.externalId, 'n1');
    assert.notEqual(messageEvent.externalId, negotiationEvent.externalId);
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

describe('parseDollarsToCents', () => {
  it('parses a plain Thumbtack money string', () => {
    assert.equal(parseDollarsToCents('$25.00'), 2500);
    assert.equal(parseDollarsToCents('$213.35'), 21335);
  });

  it('handles commas, bare numbers, and numeric input', () => {
    assert.equal(parseDollarsToCents('$1,234.56'), 123456);
    assert.equal(parseDollarsToCents('150'), 15000);
    assert.equal(parseDollarsToCents(25), 2500);
  });

  it('rounds to the nearest cent (no float drift)', () => {
    assert.equal(parseDollarsToCents('$0.1'), 10);
    assert.equal(parseDollarsToCents('$79.295'), 7930);
  });

  it('returns null on unparseable / missing input (never 0)', () => {
    assert.equal(parseDollarsToCents(''), null);
    assert.equal(parseDollarsToCents('free'), null);
    assert.equal(parseDollarsToCents(null), null);
    assert.equal(parseDollarsToCents(undefined), null);
    assert.equal(parseDollarsToCents({}), null);
  });
});

describe('isThumbtackLeadEvent', () => {
  it('recognizes a lead event and rejects others', () => {
    assert.equal(isThumbtackLeadEvent('NegotiationCreatedV4'), true);
    assert.equal(isThumbtackLeadEvent('MessageCreatedV4'), false);
    assert.equal(isThumbtackLeadEvent(null), false);
    assert.equal(isThumbtackLeadEvent(undefined), false);
  });
});

describe('extractLeadDetails', () => {
  it('pulls customer, price (as cents), category, date from a real lead event', () => {
    assert.deepEqual(extractLeadDetails(REAL_LEAD_EVENT), {
      negotiationID: '582419362774474767',
      businessId: '553306875926847497',
      customerName: 'Test Customer',
      customerPhone: '1234567890',
      leadPriceCents: 2500,
      category: 'Full Service Lawn Care',
      description: 'Need Full Service Lawn Care',
      budget: null, // this event carries no request.details[]
      timeline: null,
      status: 'Open',
      createdAtDate: '2026-06-15',
    });
  });

  it('pulls budget + timeline out of the request.details[] Q&A array', () => {
    // Real NegotiationCreatedV4 leads carry structured Q&A in request.details[];
    // budget lives under "Budget" and the timeline under "Deadline". Regression
    // for leads showing "—" for budget/timeline despite Thumbtack sending them.
    const withDetails = {
      event: { eventType: 'NegotiationCreatedV4' },
      data: {
        negotiationID: 'n1',
        request: {
          category: { name: 'Web Design' },
          details: [
            { question: 'Website type', answer: 'Social network / community' },
            { question: 'Budget', answer: 'Under $500, $500 - $1,000, $1,000 - $1,500, $1,500 - $2,000' },
            { question: 'Deadline', answer: 'Within 1 month' },
          ],
        },
      },
    };
    const d = extractLeadDetails(withDetails);
    assert.equal(d.budget, 'Under $500, $500 - $1,000, $1,000 - $1,500, $1,500 - $2,000');
    assert.equal(d.timeline, 'Within 1 month');
    assert.equal(d.category, 'Web Design');
  });

  it('matches detail questions case-insensitively and falls back Deadline->Timeline', () => {
    const d = extractLeadDetails({
      data: { request: { details: [{ question: 'timeline', answer: 'ASAP' }] } },
    });
    assert.equal(d.timeline, 'ASAP');
  });

  it('degrades to all-null (never throws) on an empty payload', () => {
    const d = extractLeadDetails({});
    assert.equal(d.customerName, null);
    assert.equal(d.leadPriceCents, null);
    assert.equal(d.budget, null);
    assert.equal(d.timeline, null);
    assert.equal(d.createdAtDate, null);
  });
});

// Trimmed from a real MessageCreatedV4 delivery (2026-06-16).
const REAL_MESSAGE_EVENT = {
  data: {
    from: 'Business',
    text: 'Did you get that PDF invoice?',
    sentAt: '2026-06-16T14:15:43Z',
    business: { businessID: '553306875926847497', displayName: 'NunezDev' },
    customer: { customerID: '582339818789650438', displayName: 'Robert Evans' },
    messageID: '582473743544885254',
    negotiationID: '582339863924105230',
  },
  event: { eventType: 'MessageCreatedV4', webhookID: '582415950855946243' },
};

describe('isThumbtackMessageEvent', () => {
  it('recognizes a message event and rejects lead/unknown', () => {
    assert.equal(isThumbtackMessageEvent('MessageCreatedV4'), true);
    assert.equal(isThumbtackMessageEvent('NegotiationCreatedV4'), false);
    assert.equal(isThumbtackMessageEvent(null), false);
  });
});

describe('extractThumbtackMessage', () => {
  it('parses a real message event (from Business -> outbound)', () => {
    assert.deepEqual(extractThumbtackMessage(REAL_MESSAGE_EVENT), {
      negotiationID: '582339863924105230',
      messageID: '582473743544885254',
      businessName: 'NunezDev',
      customerExternalId: '582339818789650438',
      customerName: 'Robert Evans',
      direction: 'outbound', // data.from === 'Business'
      text: 'Did you get that PDF invoice?',
      sentAt: '2026-06-16T14:15:43Z',
    });
  });

  it('treats a message from the Customer as inbound', () => {
    const inbound = {
      ...REAL_MESSAGE_EVENT,
      data: { ...REAL_MESSAGE_EVENT.data, from: 'Customer' },
    };
    assert.equal(extractThumbtackMessage(inbound).direction, 'inbound');
  });

  it('degrades to all-null / outbound default (never throws) on empty payload', () => {
    const m = extractThumbtackMessage({});
    assert.equal(m.negotiationID, null);
    assert.equal(m.text, null);
    assert.equal(m.direction, 'outbound');
  });
});

describe('buildThumbtackLeadInsert', () => {
  it('maps a real lead event onto the leads-table shape', () => {
    const row = buildThumbtackLeadInsert(extractLeadDetails(REAL_LEAD_EVENT));
    assert.deepEqual(row, {
      name: 'Test Customer',
      phone: '1234567890', // raw — DB layer normalizes to E.164
      project_type: 'Full Service Lawn Care',
      budget: null,
      timeline: null,
      message: 'Need Full Service Lawn Care',
      source: 'thumbtack',
      lead_source: 'Thumbtack',
      status: 'new',
      thumbtack_negotiation_id: '582419362774474767',
    });
  });

  it('always marks the lead as source=thumbtack / status=new even on a sparse event', () => {
    const row = buildThumbtackLeadInsert(extractLeadDetails({}));
    assert.equal(row.source, 'thumbtack');
    assert.equal(row.status, 'new');
    assert.equal(row.name, null);
    assert.equal(row.thumbtack_negotiation_id, null);
  });
});
