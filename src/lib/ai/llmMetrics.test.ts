/**
 * Unit tests for the Claude telemetry helper. Run with:
 *
 *   npm test
 *
 * No network, no Anthropic call, no Supabase: the cost math is pure, and the
 * recorder's resilience is checked by confirming it swallows the error when
 * Supabase is unconfigured. Mirrors the pipeline's test_llm_metrics.py.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCostUsd, recordLlmCall } from "./llmMetrics";

describe("computeCostUsd", () => {
  it("prices a known model from input + output tokens", () => {
    // 1000 in * $5/M + 500 out * $25/M = 0.005 + 0.0125
    assert.ok(Math.abs(computeCostUsd("claude-opus-4-8", 1000, 500)! - 0.0175) < 1e-9);
    assert.ok(Math.abs(computeCostUsd("claude-sonnet-4-6", 1000, 500)! - 0.0105) < 1e-9);
  });

  it("returns null for an unpriced model", () => {
    assert.equal(computeCostUsd("gpt-4", 1000, 500), null);
  });

  it("treats null/undefined token counts as zero", () => {
    assert.equal(computeCostUsd("claude-haiku-4-5", null, null), 0);
    assert.equal(computeCostUsd("claude-haiku-4-5", undefined, undefined), 0);
  });

  it("charges cache reads cheaply and cache writes at a premium", () => {
    // 1M cache-read tokens on sonnet = $3 * 0.10 = 0.30
    assert.ok(Math.abs(computeCostUsd("claude-sonnet-4-6", 0, 0, 1_000_000, 0)! - 0.3) < 1e-9);
    // 1M cache-write tokens on sonnet = $3 * 1.25 = 3.75
    assert.ok(Math.abs(computeCostUsd("claude-sonnet-4-6", 0, 0, 0, 1_000_000)! - 3.75) < 1e-9);
  });
});

describe("recordLlmCall", () => {
  it("never throws, even when Supabase is unconfigured", async () => {
    // supabaseAdmin() throws synchronously when the URL/key are missing; that
    // throw must be swallowed so telemetry can't break the AI route.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      await recordLlmCall({ callSite: "test.route", latencyMs: 5, ok: true });
      assert.ok(true); // reached here without throwing
    } finally {
      if (url !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      if (key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = key;
    }
  });
});
