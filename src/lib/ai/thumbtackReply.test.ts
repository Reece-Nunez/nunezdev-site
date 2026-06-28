/**
 * Unit tests for the Thumbtack reply helpers. Run with: npm test
 * No network. Pins the no-em-dash safety net, length cap, and prompt assembly.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeReply, buildReplyUserPrompt } from "./thumbtackReply";

describe("sanitizeReply", () => {
  it("strips em and en dashes (the house rule)", () => {
    const out = sanitizeReply("Happy to help — when works for a quick call–today?");
    assert.ok(!out.includes("—"));
    assert.ok(!out.includes("–"));
    assert.match(out, /Happy to help, when works/);
  });

  it("strips wrapping quotes and whitespace", () => {
    assert.equal(sanitizeReply('  "Hi there"  '), "Hi there");
  });

  it("collapses runs of spaces and blank lines", () => {
    assert.equal(sanitizeReply("a    b"), "a b");
    assert.equal(sanitizeReply("a\n\n\n\nb"), "a\n\nb");
  });

  it("caps length to keep it SMS-friendly", () => {
    assert.ok(sanitizeReply("x".repeat(2000)).length <= 600);
  });
});

describe("buildReplyUserPrompt", () => {
  it("includes the fields it's given", () => {
    const p = buildReplyUserPrompt({
      leadName: "Chu",
      projectType: "Web Design",
      theirMessage: "Need a new site",
    });
    assert.match(p, /Chu/);
    assert.match(p, /Web Design/);
    assert.match(p, /Need a new site/);
  });

  it("degrades gracefully when nothing is known", () => {
    const p = buildReplyUserPrompt({});
    assert.match(p, /new Thumbtack lead/i);
  });
});
