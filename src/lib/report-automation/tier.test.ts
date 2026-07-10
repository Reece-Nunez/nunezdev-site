/**
 * Unit tests for report-tier resolution. Run with:
 *
 *   npm test
 *
 * No DB, no network — these pin the cadence normalization and threshold
 * mapping that decide whether a client gets an Essential / Growth / Premium
 * report (or none, below the $150 floor).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  stripeMonthlyCents,
  invoiceMonthlyCents,
  pickTier,
  sectionsForTier,
} from "./tier";
import { SECTION_KEYS } from "./sections";

describe("stripeMonthlyCents", () => {
  it("passes a plain monthly charge through unchanged", () => {
    assert.equal(stripeMonthlyCents(15000, "month", 1), 15000);
  });

  it("spreads a yearly charge across 12 months", () => {
    assert.equal(stripeMonthlyCents(60000, "year", 1), 5000);
  });

  it("divides by interval_count for multi-month cadences (quarterly)", () => {
    assert.equal(stripeMonthlyCents(75000, "month", 3), 25000);
  });

  it("scales weekly billing up to a monthly-equivalent", () => {
    assert.equal(stripeMonthlyCents(1200, "week", 1), (1200 * 52) / 12);
  });

  it("treats an unknown interval as already-monthly", () => {
    assert.equal(stripeMonthlyCents(50000, "fortnight", 1), 50000);
  });

  it("guards against a zero/absent interval_count", () => {
    assert.equal(stripeMonthlyCents(25000, "month", 0), 25000);
    assert.equal(stripeMonthlyCents(25000, "month", null), 25000);
  });
});

describe("invoiceMonthlyCents", () => {
  it("passes monthly through and normalizes the other frequencies", () => {
    assert.equal(invoiceMonthlyCents(25000, "monthly"), 25000);
    assert.equal(invoiceMonthlyCents(75000, "quarterly"), 25000);
    assert.equal(invoiceMonthlyCents(60000, "annually"), 5000);
    assert.equal(invoiceMonthlyCents(1200, "weekly"), (1200 * 52) / 12);
  });

  it("treats an unknown frequency as monthly", () => {
    assert.equal(invoiceMonthlyCents(15000, "biweekly"), 15000);
  });
});

describe("pickTier", () => {
  it("maps each plan price to its tier", () => {
    assert.equal(pickTier(15000), "essential");
    assert.equal(pickTier(25000), "growth");
    assert.equal(pickTier(50000), "premium");
  });

  it("rounds a plan up to the highest tier it clears, not the exact price", () => {
    assert.equal(pickTier(17500), "essential"); // $175 → still Essential
    assert.equal(pickTier(30000), "growth"); // $300 → Growth
    assert.equal(pickTier(100000), "premium"); // $1000 → Premium
  });

  it("returns null below the Essential floor (no monthly report)", () => {
    assert.equal(pickTier(7500), null); // $75 Starter
    assert.equal(pickTier(14999), null);
    assert.equal(pickTier(0), null);
  });
});

describe("sectionsForTier", () => {
  it("shows every section when no tier is resolved yet", () => {
    assert.deepEqual(sectionsForTier(null), [...SECTION_KEYS]);
    assert.deepEqual(sectionsForTier(undefined), [...SECTION_KEYS]);
  });

  it("escalates as a superset: essential ⊂ growth ⊂ premium", () => {
    const essential = sectionsForTier("essential");
    const growth = sectionsForTier("growth");
    const premium = sectionsForTier("premium");
    assert.ok(essential.every(s => growth.includes(s)));
    assert.ok(growth.every(s => premium.includes(s)));
  });

  it("gates SEO to Growth+ and Analytics to Premium only", () => {
    assert.ok(!sectionsForTier("essential").includes("seo"));
    assert.ok(sectionsForTier("growth").includes("seo"));

    assert.ok(!sectionsForTier("essential").includes("analytics"));
    assert.ok(!sectionsForTier("growth").includes("analytics"));
    assert.ok(sectionsForTier("premium").includes("analytics"));
  });

  it("always includes the core technical sections at every tier", () => {
    for (const tier of ["essential", "growth", "premium"] as const) {
      for (const core of ["siteHealth", "performance", "security", "forms", "content", "hosting"] as const) {
        assert.ok(sectionsForTier(tier).includes(core), `${tier} missing ${core}`);
      }
    }
  });
});
