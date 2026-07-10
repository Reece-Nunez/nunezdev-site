/**
 * Unit tests for the tier-aware executive summary. Run with:
 *
 *   npm test
 *
 * These pin how the summary escalates across tiers — the visible difference
 * between a $150 Essential report and a $500 Premium one.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildExecutiveSummary, type SectionSummary } from "./summary";

const HEALTHY: SectionSummary[] = [
  { title: "Site Health & Uptime", status: "healthy" },
  { title: "Performance", status: "healthy" },
];

const MIXED: SectionSummary[] = [
  { title: "Site Health & Uptime", status: "healthy" },
  { title: "Performance", status: "attention" },
  { title: "Security", status: "issue" },
  { title: "Analytics Overview", status: "unknown" },
];

const RECS = ["Patch the critical dependency.", "Improve mobile performance.", "Add security headers."];

describe("buildExecutiveSummary", () => {
  it("states posture and names flagged + unverified areas", () => {
    const s = buildExecutiveSummary("essential", "Needs Attention", MIXED, RECS);
    assert.match(s, /needs attention overall health/);
    assert.match(s, /2 areas need attention: Performance, Security/);
    assert.match(s, /1 area couldn't be verified automatically and was reviewed by hand/);
  });

  it("reports a clean bill of health when nothing is flagged", () => {
    const s = buildExecutiveSummary("essential", "Excellent", HEALTHY, []);
    assert.match(s, /Every automated check that ran passed cleanly/);
  });

  it("Essential omits priorities; Growth adds the top one", () => {
    const essential = buildExecutiveSummary("essential", "Good", MIXED, RECS);
    assert.doesNotMatch(essential, /Top priority/);

    const growth = buildExecutiveSummary("growth", "Good", MIXED, RECS);
    assert.match(growth, /Top priority: Patch the critical dependency\./);
    assert.doesNotMatch(growth, /Also on our radar/);
  });

  it("Premium adds a second priority and a partnership close", () => {
    const premium = buildExecutiveSummary("premium", "Good", MIXED, RECS);
    assert.match(premium, /Top priority: Patch the critical dependency\./);
    assert.match(premium, /Also on our radar: Improve mobile performance\./);
    assert.match(premium, /reach out proactively/);
  });

  it("Premium degrades gracefully with only one recommendation", () => {
    const premium = buildExecutiveSummary("premium", "Good", MIXED, ["Only one thing."]);
    assert.match(premium, /Top priority: Only one thing\./);
    assert.doesNotMatch(premium, /Also on our radar/);
  });
});
