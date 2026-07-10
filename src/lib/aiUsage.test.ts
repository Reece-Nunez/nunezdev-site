/**
 * Unit tests for the AI-usage aggregation. Run with: npm test
 * No network -- the DB rollup is a pure function over grouped rows.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarize, type UsageGroup } from "./aiUsage";

function g(partial: Partial<UsageGroup>): UsageGroup {
  return {
    source: "crm", call_site: "x", model: "m",
    calls: 0, failures: 0, cost_usd: 0, avg_latency_ms: 0,
    input_tokens: 0, output_tokens: 0,
    ...partial,
  };
}

describe("summarize", () => {
  it("sums totals across groups and computes the failure rate", () => {
    const s = summarize([
      g({ calls: 10, failures: 1, cost_usd: 0.5, input_tokens: 100, output_tokens: 50 }),
      g({ calls: 30, failures: 3, cost_usd: 1.5, input_tokens: 300, output_tokens: 150 }),
    ]);
    assert.equal(s.totals.calls, 40);
    assert.equal(s.totals.failures, 4);
    assert.ok(Math.abs(s.totals.cost_usd - 2.0) < 1e-9);
    assert.equal(s.totals.input_tokens, 400);
    assert.equal(s.totals.output_tokens, 200);
    assert.ok(Math.abs(s.totals.failure_rate - 0.1) < 1e-9);
    assert.equal(s.groups.length, 2);
  });

  it("handles an empty set without dividing by zero", () => {
    const s = summarize([]);
    assert.equal(s.totals.calls, 0);
    assert.equal(s.totals.failure_rate, 0);
    assert.deepEqual(s.groups, []);
  });
});
