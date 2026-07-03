/**
 * Unit tests for lead-value estimation (Google Ads conversion value). Run:
 *
 *   npm test
 *
 * The invariant that matters most for bidding is the ORDERING — a bigger
 * budget must never map to a smaller value — so the tests pin both the exact
 * values and the monotonic ranking across the real BUDGET_RANGES strings.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateLeadValue } from "./leadValue";

describe("estimateLeadValue — budget brackets", () => {
  // The exact strings LeadForm's BUDGET_RANGES emits.
  const cases: Array<[string, number]> = [
    ["$1,200 – $2,500", 300],
    ["$2,500 – $5,000", 550],
    ["$5,000 – $10,000", 1100],
    ["$10,000+", 1800],
  ];

  for (const [budget, expected] of cases) {
    it(`maps "${budget}" → $${expected}`, () => {
      assert.equal(estimateLeadValue({ budget }), expected);
    });
  }

  it("increases monotonically with budget", () => {
    const values = cases.map(([budget]) => estimateLeadValue({ budget }));
    const sorted = [...values].sort((a, b) => a - b);
    assert.deepEqual(values, sorted);
  });
});

describe("estimateLeadValue — fallbacks", () => {
  it("gives software leads a higher default when no budget is picked", () => {
    assert.equal(estimateLeadValue({ source: "custom_software" }), 800);
    assert.equal(estimateLeadValue({ projectType: "Client portal or CRM" }), 800);
    assert.equal(estimateLeadValue({ projectType: "Custom web app / dashboard" }), 800);
    assert.equal(estimateLeadValue({ projectType: "Automation / API integration" }), 800);
  });

  it("uses a conservative default for generic leads with no budget", () => {
    assert.equal(estimateLeadValue({ projectType: "Marketing website" }), 400);
    assert.equal(estimateLeadValue({}), 400);
    assert.equal(estimateLeadValue({ budget: "Need help scoping" }), 400);
  });

  it("lets an explicit budget outrank the software default", () => {
    // A $10k+ software lead is worth the top bracket, not the $800 default.
    assert.equal(
      estimateLeadValue({ budget: "$10,000+", source: "custom_software" }),
      1800,
    );
  });
});
