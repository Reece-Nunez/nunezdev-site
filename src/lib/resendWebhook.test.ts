/**
 * Unit tests for verifyResendWebhook. Run with:
 *
 *   npm test
 *
 * The happy-path case uses Svix's own published example vector, so this
 * validates our hand-rolled HMAC against the canonical implementation rather
 * than against itself. If this passes, Resend's real signatures verify too.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyResendWebhook } from "./resendWebhook";

// Canonical Svix example (docs.svix.com / webhook signature verification).
const VECTOR = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: "1614265330",
  payload: '{"test": 2432232314}',
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};
const AT = 1614265330; // pin the clock to the vector's timestamp

describe("verifyResendWebhook", () => {
  it("accepts the canonical Svix signature", () => {
    const r = verifyResendWebhook({
      payload: VECTOR.payload,
      headers: { id: VECTOR.id, timestamp: VECTOR.timestamp, signature: VECTOR.signature },
      secret: VECTOR.secret,
      nowSeconds: AT,
    });
    assert.equal(r.ok, true, r.reason);
  });

  it("matches when the header carries multiple space-delimited signatures", () => {
    const r = verifyResendWebhook({
      payload: VECTOR.payload,
      headers: {
        id: VECTOR.id,
        timestamp: VECTOR.timestamp,
        signature: `v1,wrongsig v2,alsowrong ${VECTOR.signature}`,
      },
      secret: VECTOR.secret,
      nowSeconds: AT,
    });
    assert.equal(r.ok, true, r.reason);
  });

  it("rejects a tampered payload", () => {
    const r = verifyResendWebhook({
      payload: '{"test": 9999999999}',
      headers: { id: VECTOR.id, timestamp: VECTOR.timestamp, signature: VECTOR.signature },
      secret: VECTOR.secret,
      nowSeconds: AT,
    });
    assert.equal(r.ok, false);
  });

  it("rejects a stale timestamp (replay window)", () => {
    const r = verifyResendWebhook({
      payload: VECTOR.payload,
      headers: { id: VECTOR.id, timestamp: VECTOR.timestamp, signature: VECTOR.signature },
      secret: VECTOR.secret,
      nowSeconds: AT + 6 * 60, // 6 min later, outside the 5 min tolerance
    });
    assert.equal(r.ok, false);
    assert.match(r.reason ?? "", /tolerance/);
  });

  it("rejects missing headers", () => {
    const r = verifyResendWebhook({
      payload: VECTOR.payload,
      headers: { id: "", timestamp: "", signature: "" },
      secret: VECTOR.secret,
      nowSeconds: AT,
    });
    assert.equal(r.ok, false);
  });
});
