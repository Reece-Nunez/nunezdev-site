/**
 * Unit tests for the keyword-volume pure helpers. Run with:
 *
 *   npm test
 *
 * No DB, no network, no credentials. These pin the row selection + staleness
 * logic that decides which number the outreach line quotes and when the cache
 * re-fetches — the parts most likely to silently drift.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeKeyword,
  metroLabel,
  sanitizeGaqlLiteral,
  pickVolume,
  pickGeoTarget,
  isStale,
} from "./keywordVolumeTransform";

describe("normalizeKeyword", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    assert.equal(normalizeKeyword("  Plumber "), "plumber");
    assert.equal(normalizeKeyword("House   Painter"), "house painter");
  });
  it("handles empty/nullish input", () => {
    assert.equal(normalizeKeyword(""), "");
    assert.equal(normalizeKeyword(undefined as unknown as string), "");
  });
});

describe("metroLabel", () => {
  it("joins city and state", () => {
    assert.equal(metroLabel("Tulsa", "Oklahoma"), "Tulsa, Oklahoma");
  });
  it("drops the state when absent", () => {
    assert.equal(metroLabel("Tulsa", ""), "Tulsa");
  });
});

describe("sanitizeGaqlLiteral", () => {
  it("strips quotes and backslashes that could break the GAQL literal", () => {
    assert.equal(sanitizeGaqlLiteral("O'Fallon"), "OFallon");
    assert.equal(sanitizeGaqlLiteral('Tulsa" OR "1'), "Tulsa OR 1");
  });
  it("caps length", () => {
    assert.equal(sanitizeGaqlLiteral("a".repeat(200)).length, 80);
  });
});

describe("pickVolume", () => {
  const ideas = [
    { text: "plumber near me", keyword_idea_metrics: { avg_monthly_searches: 5000 } },
    { text: "plumber", keyword_idea_metrics: { avg_monthly_searches: 1200 } },
    { text: "emergency plumber", keyword_idea_metrics: { avg_monthly_searches: 300 } },
  ];
  it("prefers the exact-match seed over the first idea", () => {
    assert.equal(pickVolume(ideas, "plumber"), 1200);
  });
  it("falls back to the first idea when no exact match", () => {
    assert.equal(pickVolume(ideas, "roofer"), 5000);
  });
  it("coerces string volumes and rounds", () => {
    assert.equal(
      pickVolume([{ text: "x", keyword_idea_metrics: { avg_monthly_searches: "890.6" } }], "x"),
      891,
    );
  });
  it("returns 0 for empty ideas or missing/zero metrics", () => {
    assert.equal(pickVolume([], "plumber"), 0);
    assert.equal(pickVolume([{ text: "x" }], "x"), 0);
    assert.equal(
      pickVolume([{ text: "x", keyword_idea_metrics: { avg_monthly_searches: null } }], "x"),
      0,
    );
  });
});

describe("pickGeoTarget", () => {
  const rows = [
    { geo_target_constant: { id: 1, canonical_name: "Stillwater,Minnesota,United States" } },
    { geo_target_constant: { id: 2, canonical_name: "Stillwater,Oklahoma,United States" } },
  ];
  it("matches on the state inside canonical_name", () => {
    assert.equal(pickGeoTarget(rows, "Oklahoma")?.geo_target_constant?.id, 2);
  });
  it("falls back to the first row when no state match", () => {
    assert.equal(pickGeoTarget(rows, "Texas")?.geo_target_constant?.id, 1);
  });
  it("returns null when there are no rows", () => {
    assert.equal(pickGeoTarget([], "Oklahoma"), null);
  });
});

describe("isStale", () => {
  const now = new Date("2026-07-03T00:00:00Z");
  it("is fresh within the window", () => {
    assert.equal(isStale("2026-06-20T00:00:00Z", now, 30), false); // 13 days old
  });
  it("is stale past the window", () => {
    assert.equal(isStale("2026-05-01T00:00:00Z", now, 30), true); // 63 days old
  });
  it("treats missing or invalid timestamps as stale", () => {
    assert.equal(isStale(null, now, 30), true);
    assert.equal(isStale("not-a-date", now, 30), true);
  });
});
