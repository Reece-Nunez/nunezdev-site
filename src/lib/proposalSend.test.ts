/**
 * Unit tests for proposal share-channel helpers. Run:
 *
 *   npm test
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveSendChannel, channelWants, proposalPublicUrl } from "./proposalSend";

describe("resolveSendChannel", () => {
  it("passes through known channels", () => {
    assert.equal(resolveSendChannel("email"), "email");
    assert.equal(resolveSendChannel("sms"), "sms");
    assert.equal(resolveSendChannel("both"), "both");
    assert.equal(resolveSendChannel("link"), "link");
  });

  it("defaults to email for anything unknown or missing", () => {
    assert.equal(resolveSendChannel(undefined), "email");
    assert.equal(resolveSendChannel(null), "email");
    assert.equal(resolveSendChannel("carrier-pigeon"), "email");
    assert.equal(resolveSendChannel(42), "email");
  });
});

describe("channelWants", () => {
  it("email delivers email only", () => {
    assert.deepEqual(channelWants("email"), { email: true, sms: false, link: false });
  });

  it("sms delivers sms only", () => {
    assert.deepEqual(channelWants("sms"), { email: false, sms: true, link: false });
  });

  it("both delivers email and sms", () => {
    assert.deepEqual(channelWants("both"), { email: true, sms: true, link: false });
  });

  it("link delivers nothing (copy-only, just flips status)", () => {
    assert.deepEqual(channelWants("link"), { email: false, sms: false, link: true });
  });
});

describe("proposalPublicUrl", () => {
  it("builds the public token URL", () => {
    assert.equal(
      proposalPublicUrl("https://nunezdev.com", "abc123"),
      "https://nunezdev.com/proposal/abc123",
    );
  });

  it("tolerates a trailing slash on the origin", () => {
    assert.equal(
      proposalPublicUrl("https://nunezdev.com/", "abc123"),
      "https://nunezdev.com/proposal/abc123",
    );
    assert.equal(
      proposalPublicUrl("http://localhost:3000///", "tok"),
      "http://localhost:3000/proposal/tok",
    );
  });
});
