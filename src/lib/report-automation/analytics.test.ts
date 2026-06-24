/**
 * Unit tests for the GA4 traffic aggregator. Run with:
 *
 *   npm test
 *
 * No DB, no network. These pin the fix for the bug where two date ranges were
 * requested in a single GA4 call and every row's metrics were summed together —
 * inflating the headline "Total Visitors" by mixing the current and previous
 * month. The aggregator now operates on ONE date range at a time.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregateTraffic, type GA4Row } from "./analytics";

function row(pagePath: string, users: number, sessions: number, bounce: number): GA4Row {
  return {
    dimensionValues: [{ value: pagePath }],
    metricValues: [{ value: String(users) }, { value: String(sessions) }, { value: String(bounce) }],
  };
}

describe("aggregateTraffic", () => {
  it("sums users and sessions across page rows", () => {
    const totals = aggregateTraffic([
      row("/", 100, 120, 0.4),
      row("/about", 30, 35, 0.6),
    ]);
    assert.equal(totals.totalUsers, 130);
    assert.equal(totals.totalSessions, 155);
  });

  it("picks the page with the most sessions as the top page", () => {
    const totals = aggregateTraffic([
      row("/", 100, 120, 0.4),
      row("/pricing", 50, 200, 0.3),
    ]);
    assert.equal(totals.topPage, "/pricing");
    assert.equal(totals.topPageSessions, 200);
  });

  it("converts GA4's 0-1 bounce ratio to a session-weighted percentage", () => {
    const totals = aggregateTraffic([
      row("/", 0, 100, 0.2), // 20%
      row("/x", 0, 300, 0.6), // 60%
    ]);
    // weighted: (0.2*100 + 0.6*300) / 400 = (20 + 180) / 400 = 0.5 -> 50%
    assert.equal(Math.round(totals.avgBounceRate), 50);
  });

  it("returns zeroed totals (no divide-by-zero) for an empty range", () => {
    const totals = aggregateTraffic([]);
    assert.equal(totals.totalUsers, 0);
    assert.equal(totals.totalSessions, 0);
    assert.equal(totals.avgBounceRate, 0);
    assert.equal(totals.topPage, "/");
  });

  it("does NOT mix two months: each range aggregates independently", () => {
    // The old bug summed both ranges into one number. Aggregating per-range
    // keeps the current month honest.
    const current = aggregateTraffic([row("/", 200, 250, 0.4)]);
    const previous = aggregateTraffic([row("/", 100, 130, 0.5)]);
    assert.equal(current.totalUsers, 200); // not 300
    const changePct = Math.round(((current.totalUsers - previous.totalUsers) / previous.totalUsers) * 100);
    assert.equal(changePct, 100); // doubled month over month
  });
});
