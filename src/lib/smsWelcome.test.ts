/**
 * Unit tests for the consent-lifecycle SMS builders. Run with:
 *
 *   npm test
 *
 * These messages are A2P 10DLC compliance artifacts: carriers expect the
 * brand name and STOP/HELP keywords. The tests pin those (and the friendly
 * greeting) so a future copy edit can't silently drop a required element.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWelcomeSms, buildOptInRequestSms } from "./smsWelcome";

describe("buildWelcomeSms", () => {
  it("includes the brand and required A2P keywords", () => {
    const msg = buildWelcomeSms({ name: "Alex Smith" });
    assert.match(msg, /NunezDev/);
    assert.match(msg, /Reply STOP to opt out/);
    assert.match(msg, /HELP for help/);
    assert.match(msg, /rates may apply/);
  });

  it("greets by first name when provided", () => {
    assert.match(buildWelcomeSms({ name: "Alex Smith" }), /^You're in, Alex!/);
  });

  it("falls back gracefully when the name is missing or blank", () => {
    for (const name of [undefined, null, "", "   "]) {
      const msg = buildWelcomeSms({ name });
      assert.match(msg, /^You're in! /);
      assert.doesNotMatch(msg, /, !/);
    }
  });
});

describe("buildOptInRequestSms", () => {
  it("asks for a YES reply and carries the required A2P keywords", () => {
    const msg = buildOptInRequestSms({ name: "Jordan Lee" });
    assert.match(msg, /NunezDev/);
    assert.match(msg, /Reply YES/);
    assert.match(msg, /Reply STOP to opt out/);
    assert.match(msg, /HELP for help/);
    assert.match(msg, /rates may apply/);
  });

  it("greets by first name, and stays graceful without one", () => {
    assert.match(buildOptInRequestSms({ name: "Jordan Lee" }), /^Hey Jordan!/);
    assert.match(buildOptInRequestSms({ name: "" }), /^Hey! /);
  });
});
