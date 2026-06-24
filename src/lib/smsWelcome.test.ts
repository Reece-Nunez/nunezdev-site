/**
 * Unit tests for buildWelcomeSms. Run with:
 *
 *   npm test
 *
 * The welcome SMS is an A2P 10DLC compliance artifact: carriers expect the
 * opt-in confirmation to name the brand and carry STOP/HELP. These tests pin
 * that the required keywords survive any future copy edits.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWelcomeSms } from "./smsWelcome";

describe("buildWelcomeSms", () => {
  it("includes the brand and required A2P keywords", () => {
    const msg = buildWelcomeSms({ name: "Alex Smith" });
    assert.match(msg, /NunezDev/);
    assert.match(msg, /Reply STOP to opt out/);
    assert.match(msg, /HELP for help/);
    assert.match(msg, /rates may apply/);
  });

  it("greets by first name when provided", () => {
    assert.match(buildWelcomeSms({ name: "Alex Smith" }), /^Hi Alex,/);
  });

  it("falls back gracefully when the name is missing or blank", () => {
    for (const name of [undefined, null, "", "   "]) {
      const msg = buildWelcomeSms({ name });
      assert.match(msg, /^You're opted in/);
      assert.doesNotMatch(msg, /Hi ,/);
    }
  });

  it("stays within 2 SMS segments (<=320 chars)", () => {
    assert.ok(buildWelcomeSms({ name: "Alexandria Montgomery" }).length <= 320);
  });
});
