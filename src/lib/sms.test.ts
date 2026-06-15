/**
 * Unit tests for normalizePhoneE164. Run with:
 *
 *   npm test
 *
 * This is the shared canonicalizer for both outbound (composer) and inbound
 * (Twilio webhook `from`) phone numbers. The inbox keys SMS conversations on
 * the E.164 form, so if these don't all converge to the SAME string, an
 * inbound reply would open a NEW thread instead of joining the outbound one.
 * These tests pin that convergence.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePhoneE164 } from "./sms";

const CANON = "+14055551234";

describe("normalizePhoneE164", () => {
  it("canonicalizes every common US format to the same E.164 string", () => {
    const inputs = [
      "+14055551234",      // already E.164 (what Twilio sends inbound)
      "4055551234",        // bare 10-digit
      "(405) 555-1234",    // formatted
      "405-555-1234",
      "405.555.1234",
      "1-405-555-1234",    // with country code
      "+1 405 555 1234",
    ];
    for (const input of inputs) {
      assert.equal(normalizePhoneE164(input), CANON, `failed for: ${input}`);
    }
  });

  it("rejects non-US / malformed numbers (returns null)", () => {
    assert.equal(normalizePhoneE164(""), null);
    assert.equal(normalizePhoneE164("123"), null);
    assert.equal(normalizePhoneE164("+447911123456"), null); // UK
    assert.equal(normalizePhoneE164("notaphone"), null);
  });
});
