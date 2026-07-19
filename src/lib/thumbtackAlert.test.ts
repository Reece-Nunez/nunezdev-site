/**
 * Unit tests for the new-lead owner alert body. Run with:
 *
 *   npm test
 *
 * The point of this alert is response speed, so the tests pin the two things
 * that make it actionable on a lock screen: the name leads, and the message
 * stays short enough not to fan out into a wall of segments.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLeadAlertSms } from "./thumbtackAlert";
import type { ThumbtackLeadDetails } from "./thumbtackWebhook";

const BASE = "https://www.nunezdev.com";

function details(over: Partial<ThumbtackLeadDetails> = {}): ThumbtackLeadDetails {
  return {
    negotiationID: "neg_1",
    businessId: "biz_1",
    customerName: "Jane Doe",
    customerPhone: "405-555-1234",
    leadPriceCents: 2500,
    category: "Custom Software",
    description: "Need a CRM for my roofing crew",
    budget: "$5,000",
    timeline: "ASAP",
    status: "new",
    createdAtDate: "2026-07-19",
    ...over,
  };
}

describe("buildLeadAlertSms", () => {
  it("leads with the customer name and includes the key facts", () => {
    const msg = buildLeadAlertSms(details(), BASE);
    assert.match(msg, /^New Thumbtack lead: Jane Doe/);
    assert.match(msg, /Custom Software · \$5,000 · ASAP/);
    assert.match(msg, /Need a CRM for my roofing crew/);
    assert.match(msg, /405-555-1234/);
    assert.match(msg, /https:\/\/www\.nunezdev\.com\/dashboard\/leads/);
  });

  it("drops missing fields instead of rendering empty lines", () => {
    const msg = buildLeadAlertSms(
      details({ category: null, budget: null, timeline: null, description: null, customerPhone: null }),
      BASE,
    );
    assert.equal(msg, `New Thumbtack lead: Jane Doe\n${BASE}/dashboard/leads`);
  });

  it("falls back to Unknown when the payload carries no name", () => {
    assert.match(buildLeadAlertSms(details({ customerName: null }), BASE), /lead: Unknown/);
  });

  it("truncates a long description so one lead can't blow up the segment count", () => {
    const msg = buildLeadAlertSms(details({ description: "x".repeat(500) }), BASE);
    assert.match(msg, /…"/);
    assert.ok(msg.length < 320, `expected under 2 segments, got ${msg.length} chars`);
  });

  it("collapses newlines in the description so the quote stays on one line", () => {
    const msg = buildLeadAlertSms(details({ description: "line one\n\nline two" }), BASE);
    assert.match(msg, /"line one line two"/);
  });
});
