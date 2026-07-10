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
import { aggregateTraffic, buildAnalyticsInsights, type GA4Row, type TrafficTotals } from "./analytics";

function totals(partial: Partial<TrafficTotals> = {}): TrafficTotals {
  return {
    totalUsers: 0,
    totalSessions: 0,
    avgBounceRate: 0,
    topPage: "/",
    topPageSessions: 0,
    ...partial,
  };
}

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

describe("buildAnalyticsInsights", () => {
  it("narrates visitors, sessions, and month-over-month direction", () => {
    const current = totals({ totalUsers: 1200, totalSessions: 1500, avgBounceRate: 42, topPage: "/services", topPageSessions: 420 });
    const previous = totals({ totalUsers: 1000 });
    const { narrative } = buildAnalyticsInsights(current, previous, 12);
    assert.match(narrative, /1,200 visitors across 1,500 sessions/);
    assert.match(narrative, /up 20% versus the prior month/);
    assert.match(narrative, /strongest page was \/services with 420 sessions/);
    assert.match(narrative, /12 form submissions came in — a 1\.0% visitor-to-lead rate/);
    assert.match(narrative, /Bounce rate was 42\.0%/);
  });

  it("omits the trend clause when there is no prior-month baseline", () => {
    const current = totals({ totalUsers: 500, totalSessions: 600, avgBounceRate: 30 });
    const { narrative, recommendations } = buildAnalyticsInsights(current, totals(), 5);
    assert.doesNotMatch(narrative, /versus the prior month/);
    assert.deepEqual(recommendations, []); // healthy month, nothing to flag
  });

  it("flags a high bounce rate", () => {
    const current = totals({ totalUsers: 800, totalSessions: 900, avgBounceRate: 78 });
    const { recommendations } = buildAnalyticsInsights(current, totals({ totalUsers: 790 }), 10);
    assert.ok(recommendations.some(r => /Bounce rate is 78%/.test(r)));
  });

  it("flags zero leads despite traffic, and a steep traffic drop", () => {
    const current = totals({ totalUsers: 1000, totalSessions: 1100, avgBounceRate: 40 });
    const previous = totals({ totalUsers: 1500 }); // down ~33%
    const { recommendations } = buildAnalyticsInsights(current, previous, 0);
    assert.ok(recommendations.some(r => /No form submissions/.test(r)));
    assert.ok(recommendations.some(r => /Traffic fell 33% month-over-month/.test(r)));
  });

  it("flags a weak conversion rate under 1%", () => {
    const current = totals({ totalUsers: 5000, totalSessions: 6000, avgBounceRate: 45 });
    const { recommendations } = buildAnalyticsInsights(current, totals({ totalUsers: 5000 }), 20); // 0.4%
    assert.ok(recommendations.some(r => /Visitor-to-lead conversion is 0\.4%/.test(r)));
  });

  it("handles a zero-traffic month without dividing by zero", () => {
    const { narrative, recommendations } = buildAnalyticsInsights(totals(), totals(), 0);
    assert.match(narrative, /No visitor activity was recorded/);
    assert.deepEqual(recommendations, []); // no traffic → nothing actionable to suggest
  });
});
