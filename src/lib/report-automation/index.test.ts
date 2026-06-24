/**
 * Unit tests for the report's overall-status roll-up. Run with:
 *
 *   npm test
 *
 * Pins that a check which could not run (`unknown`) can NEVER inflate the
 * headline to "Excellent" — a failed check must not read as "all good".
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeOverallStatus, normalizeWebsiteUrl } from "./index";

describe("computeOverallStatus", () => {
  it("is Excellent only when every section is healthy", () => {
    assert.equal(computeOverallStatus(["healthy", "healthy", "healthy"]), "Excellent");
  });

  it("is Needs Attention if any section has an issue", () => {
    assert.equal(computeOverallStatus(["healthy", "issue", "attention"]), "Needs Attention");
  });

  it("is Good (not Excellent) when something only needs attention", () => {
    assert.equal(computeOverallStatus(["healthy", "attention"]), "Good");
  });

  it("treats an unverified section as Good, never Excellent", () => {
    assert.equal(computeOverallStatus(["healthy", "unknown"]), "Good");
  });
});

describe("normalizeWebsiteUrl", () => {
  it("adds https:// to a scheme-less host (the gogoldman.com parse bug)", () => {
    assert.equal(normalizeWebsiteUrl("www.gogoldman.com"), "https://www.gogoldman.com");
    assert.equal(normalizeWebsiteUrl("gogoldman.com"), "https://gogoldman.com");
  });

  it("leaves an existing scheme untouched", () => {
    assert.equal(normalizeWebsiteUrl("https://example.com"), "https://example.com");
    assert.equal(normalizeWebsiteUrl("http://example.com"), "http://example.com");
  });

  it("trims surrounding whitespace and passes empty through", () => {
    assert.equal(normalizeWebsiteUrl("  example.com  "), "https://example.com");
    assert.equal(normalizeWebsiteUrl(""), "");
  });
});
