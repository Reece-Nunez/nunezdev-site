/**
 * Unit tests for decideComposerSmsAction. Run with:
 *
 *   npm test
 *
 * This is the consent policy for operator-initiated texts (inbox composer /
 * reply). The key subtlety it pins: a reply to someone who texted us first is
 * allowed even without a formal opt-in, but a cold, operator-initiated text to
 * a non-consented number must send the "reply YES" request instead.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideComposerSmsAction } from "./smsConsent";

describe("decideComposerSmsAction", () => {
  it("blocks anyone who opted out, regardless of anything else", () => {
    assert.equal(
      decideComposerSmsAction({ optedOut: true, consented: true, hasInbound: true }),
      "block",
    );
  });

  it("sends to a consented contact", () => {
    assert.equal(
      decideComposerSmsAction({ optedOut: false, consented: true, hasInbound: false }),
      "send",
    );
  });

  it("allows a reply to someone who texted us first, even without consent", () => {
    assert.equal(
      decideComposerSmsAction({ optedOut: false, consented: false, hasInbound: true }),
      "send",
    );
  });

  it("requests opt-in for a cold text to a non-consented number", () => {
    assert.equal(
      decideComposerSmsAction({ optedOut: false, consented: false, hasInbound: false }),
      "request_optin",
    );
  });
});
