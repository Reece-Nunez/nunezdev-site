/**
 * Unit tests for the Thumbtack ROI matcher/aggregator. Run with:
 *   npx tsx --test src/lib/thumbtackRoi.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  phoneKey,
  nameKey,
  computeThumbtackRoi,
  type RoiLead,
  type RoiClient,
} from "./thumbtackRoi";

describe("phoneKey", () => {
  it("reduces to last 10 digits, ignoring +1 and formatting", () => {
    assert.equal(phoneKey("+1 (405) 555-1234"), "4055551234");
    assert.equal(phoneKey("405.555.1234"), "4055551234");
    assert.equal(phoneKey("14055551234"), "4055551234");
  });
  it("returns null when there aren't 10 digits", () => {
    assert.equal(phoneKey("555-12"), null);
    assert.equal(phoneKey(null), null);
    assert.equal(phoneKey(""), null);
  });
});

describe("nameKey", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    assert.equal(nameKey("  Hady  O'Brien "), "hady obrien");
    assert.equal(nameKey("JOHN   SMITH"), "john smith");
  });
  it("returns null for empty/nullish", () => {
    assert.equal(nameKey(null), null);
    assert.equal(nameKey("  "), null);
  });
});

const clients: RoiClient[] = [
  { id: "c1", name: "Hady Obrien", phone: "(405) 555-1234", email: "hady@x.com" },
  { id: "c2", name: "Jane Doe", phone: "405-555-9999", email: "jane@x.com" },
  { id: "c3", name: "Bob Vance", phone: null, email: "bob@x.com" },
];

describe("computeThumbtackRoi", () => {
  it("matches by explicit link, phone, and name; leaves the rest unmatched", () => {
    const leads: RoiLead[] = [
      { negotiationId: "n1", name: "different name", phone: null, priceCents: 2500, dateISO: "2026-01-01", linkedClientId: "c1" },
      { negotiationId: "n2", name: "whoever", phone: "+14055559999", priceCents: 2500, dateISO: "2026-01-02" },
      { negotiationId: "n3", name: "Bob Vance", phone: null, priceCents: 2500, dateISO: "2026-01-03" },
      { negotiationId: "n4", name: "Nobody Here", phone: "2225557777", priceCents: 2500, dateISO: "2026-01-04" },
    ];
    const collected = { c1: 500000, c2: 0, c3: 120000 };
    const roi = computeThumbtackRoi(leads, clients, collected);

    const byNeg = Object.fromEntries(roi.rows.map((r) => [r.negotiationId, r]));
    assert.equal(byNeg.n1.confidence, "linked");
    assert.equal(byNeg.n1.outcome, "won"); // c1 has revenue
    assert.equal(byNeg.n2.confidence, "phone");
    assert.equal(byNeg.n2.outcome, "in_progress"); // c2 matched but $0 collected
    assert.equal(byNeg.n3.confidence, "name");
    assert.equal(byNeg.n3.outcome, "won"); // c3 has revenue
    assert.equal(byNeg.n4.confidence, null);
    assert.equal(byNeg.n4.outcome, "unmatched");
  });

  it("aggregates spend, revenue (distinct clients), win rate, and ROI", () => {
    const leads: RoiLead[] = [
      { negotiationId: "n1", name: "Hady Obrien", phone: null, priceCents: 3000, dateISO: null },
      { negotiationId: "n2", name: "Hady Obrien", phone: null, priceCents: 3000, dateISO: null }, // same client twice
      { negotiationId: "n3", name: "Jane Doe", phone: null, priceCents: 4000, dateISO: null },
    ];
    const collected = { c1: 900000, c2: 0 };
    const roi = computeThumbtackRoi(leads, clients, collected);

    assert.equal(roi.leadCount, 3);
    assert.equal(roi.spendCents, 10000); // 3000 + 3000 + 4000
    assert.equal(roi.matchedClientCount, 2); // c1 (x2 leads) + c2
    assert.equal(roi.wonClientCount, 1); // only c1 has revenue
    assert.equal(roi.revenueCents, 900000); // c1 counted ONCE, not per-lead
    assert.equal(roi.netCents, 890000);
    assert.equal(roi.roiMultiple, 90); // 900000 / 10000
    assert.equal(roi.winRate, 1 / 3); // 1 won client / 3 leads
    assert.equal(roi.avgCostPerLeadCents, 3333);
    assert.equal(roi.avgRevenuePerWonCents, 900000);
  });

  it("returns null ratios when there's no spend or no leads", () => {
    const empty = computeThumbtackRoi([], clients, {});
    assert.equal(empty.roiMultiple, null);
    assert.equal(empty.roiPct, null);
    assert.equal(empty.winRate, null);

    const noSpend = computeThumbtackRoi(
      [{ negotiationId: "n1", name: "Jane Doe", phone: null, priceCents: 0, dateISO: null }],
      clients,
      { c2: 0 },
    );
    assert.equal(noSpend.roiMultiple, null); // spend is 0
    assert.equal(noSpend.winRate, 0); // 0 won / 1 lead
  });
});
