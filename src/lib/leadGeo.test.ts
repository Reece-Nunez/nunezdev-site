/**
 * Unit tests for geo-based lead quality screening. Run with:
 *
 *   npm test
 *
 * Two invariants, mirroring leadSpamFilter's bias toward not losing customers:
 *   1. Unknown geography NEVER quarantines a lead (fail open).
 *   2. Only a known, non-allowlisted country is flagged low quality.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRequestCountry, isLowQualityGeo, ALLOWED_COUNTRIES } from "./leadGeo";

// Minimal Headers stand-in so we don't depend on a DOM/undici Headers impl.
function headers(map: Record<string, string>): Pick<Headers, "get"> {
  const lower = new Map(
    Object.entries(map).map(([k, v]) => [k.toLowerCase(), v])
  );
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

describe("getRequestCountry", () => {
  it("reads the Vercel geo header and uppercases it", () => {
    assert.equal(getRequestCountry(headers({ "x-vercel-ip-country": "us" })), "US");
  });

  it("falls back to the Cloudflare header when Vercel's is absent", () => {
    assert.equal(getRequestCountry(headers({ "cf-ipcountry": "IN" })), "IN");
  });

  it("prefers the Vercel header over Cloudflare when both are present", () => {
    assert.equal(
      getRequestCountry(
        headers({ "x-vercel-ip-country": "CA", "cf-ipcountry": "IN" })
      ),
      "CA"
    );
  });

  it("returns null when no geo header is present (dev / preview)", () => {
    assert.equal(getRequestCountry(headers({})), null);
  });

  it("treats Cloudflare's XX (unknown) and T1 (Tor) as null", () => {
    assert.equal(getRequestCountry(headers({ "cf-ipcountry": "XX" })), null);
    assert.equal(getRequestCountry(headers({ "cf-ipcountry": "T1" })), null);
  });
});

describe("isLowQualityGeo", () => {
  it("does NOT flag allowlisted countries", () => {
    for (const c of ALLOWED_COUNTRIES) {
      assert.equal(isLowQualityGeo(c), false, c);
    }
  });

  it("flags a known country outside the allowlist", () => {
    for (const c of ["IN", "PK", "NG", "BD", "PH"]) {
      assert.equal(isLowQualityGeo(c), true, c);
    }
  });

  it("does NOT flag unknown geography (fail open)", () => {
    assert.equal(isLowQualityGeo(null), false);
  });
});
