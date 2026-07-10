/**
 * Unit tests for the month-over-month snapshot deltas. Run with:
 *
 *   npm test
 *
 * No network / DB — these pin the GSC trend wording and the sitemap diff. The
 * fetch/DB helpers are thin shells and aren't unit-tested.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeGscTrend, computeSitemapDiff } from "./snapshots";

describe("computeGscTrend", () => {
  it("describes clicks + impressions direction vs last month", () => {
    const t = computeGscTrend({ clicks: 144, impressions: 2200 }, { clicks: 120, impressions: 2000 });
    assert.match(t.note, /Search clicks up 20% vs last month \(120 → 144\)/);
    assert.match(t.note, /impressions up 10%/);
    assert.equal(t.recommendation, undefined);
  });

  it("recommends action on a >=20% clicks drop", () => {
    const t = computeGscTrend({ clicks: 70, impressions: 1800 }, { clicks: 100, impressions: 2000 });
    assert.match(t.note, /Search clicks down 30%/);
    assert.match(t.recommendation ?? "", /fell 30% month-over-month/);
  });

  it("returns an empty note when there's no baseline (previous had 0 clicks)", () => {
    const t = computeGscTrend({ clicks: 50, impressions: 900 }, { clicks: 0, impressions: 0 });
    assert.equal(t.note, "");
    assert.equal(t.recommendation, undefined);
  });
});

describe("computeSitemapDiff", () => {
  it("reports pages added and removed since last month", () => {
    const d = computeSitemapDiff(
      ["https://x.com/", "https://x.com/new", "https://x.com/services"],
      ["https://x.com/", "https://x.com/services", "https://x.com/old"],
    );
    assert.deepEqual(d.added, ["https://x.com/new"]);
    assert.deepEqual(d.removed, ["https://x.com/old"]);
    assert.match(d.note, /1 new page since last month/);
    assert.match(d.note, /1 page removed/);
  });

  it("pluralizes and handles a pure-addition month", () => {
    const d = computeSitemapDiff(["/a", "/b", "/c"], ["/a"]);
    assert.deepEqual(d.added, ["/b", "/c"]);
    assert.deepEqual(d.removed, []);
    assert.match(d.note, /2 new pages since last month/);
    assert.doesNotMatch(d.note, /removed/);
  });

  it("is empty when nothing changed", () => {
    const d = computeSitemapDiff(["/a", "/b"], ["/b", "/a"]);
    assert.deepEqual(d.added, []);
    assert.deepEqual(d.removed, []);
    assert.equal(d.note, "");
  });
});
