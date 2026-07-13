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
import { decideComposerSmsAction, decideOptInKeywordAction } from "./smsConsent";

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

  it("sends a cold text to a non-consented number (consent gate removed)", () => {
    // Owner policy: affirmative opt-in is no longer required. The only hard
    // stop is an explicit opt-out (covered by the 'block' case above).
    assert.equal(
      decideComposerSmsAction({ optedOut: false, consented: false, hasInbound: false }),
      "send",
    );
  });
});

describe("decideOptInKeywordAction", () => {
  it("treats YES as normal conversation when already actively consented", () => {
    // The reported bug: an opted-in client texting "Yes, Tuesday works" was
    // re-sent the welcome/opt-in confirmation every time.
    assert.equal(
      decideOptInKeywordAction({ consented: true, optedOut: false, alreadyWelcomed: false }),
      "treat_as_normal",
    );
  });

  it("grants + welcomes a YES from a not-yet-consented, never-welcomed number", () => {
    // Completes the double opt-in for a fresh contact.
    assert.equal(
      decideOptInKeywordAction({ consented: false, optedOut: false, alreadyWelcomed: false }),
      "grant_and_welcome",
    );
  });

  it("stays quiet when a non-client/lead number was already welcomed", () => {
    // The reported bug: a bare phone (no consent row) got the welcome on EVERY
    // yes because consent could never be read back. alreadyWelcomed remembers.
    assert.equal(
      decideOptInKeywordAction({ consented: false, optedOut: false, alreadyWelcomed: true }),
      "treat_as_normal",
    );
  });

  it("grants + welcomes a YES/START from someone who previously opted out", () => {
    // Re-subscribe path: opted_out overrides a stale consented flag.
    assert.equal(
      decideOptInKeywordAction({ consented: true, optedOut: true, alreadyWelcomed: false }),
      "grant_and_welcome",
    );
  });

  it("re-welcomes on re-opt-in even if welcomed before (opt-out wins over dedup)", () => {
    assert.equal(
      decideOptInKeywordAction({ consented: false, optedOut: true, alreadyWelcomed: true }),
      "grant_and_welcome",
    );
  });
});
