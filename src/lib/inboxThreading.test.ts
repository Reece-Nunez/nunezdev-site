/**
 * Unit tests for the pure inbox threading helpers. Run with:
 *
 *   npm test
 *
 * No DB, no network. These pin the contract that an emailed Reply-To round-
 * trips back to its conversation id, and that a foreign / malformed address
 * can NOT be coerced into a thread (which would leak a reply into the wrong
 * conversation).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INBOX_REPLY_DOMAIN,
  buildReplyToAddress,
  parseConversationIdFromAddress,
} from "./inboxThreading";

const UUID = "3f8b1c2a-9d4e-4f6a-8b2c-1d2e3f4a5b6c";

describe("buildReplyToAddress", () => {
  it("formats <id>@<reply-domain>", () => {
    assert.equal(buildReplyToAddress(UUID), `${UUID}@${INBOX_REPLY_DOMAIN}`);
  });
});

describe("parseConversationIdFromAddress", () => {
  it("round-trips a built address back to the id", () => {
    assert.equal(parseConversationIdFromAddress(buildReplyToAddress(UUID)), UUID);
  });

  it("extracts the id from a 'Name <addr>' form", () => {
    assert.equal(
      parseConversationIdFromAddress(`Jane Doe <${UUID}@${INBOX_REPLY_DOMAIN}>`),
      UUID,
    );
  });

  it("is case-insensitive and normalizes to lowercase", () => {
    assert.equal(
      parseConversationIdFromAddress(`${UUID.toUpperCase()}@${INBOX_REPLY_DOMAIN.toUpperCase()}`),
      UUID,
    );
  });

  it("rejects a foreign domain (no thread hijack)", () => {
    assert.equal(parseConversationIdFromAddress(`${UUID}@evil.com`), null);
  });

  it("rejects a non-UUID local part", () => {
    assert.equal(parseConversationIdFromAddress(`reece@${INBOX_REPLY_DOMAIN}`), null);
  });

  it("rejects addresses with no @", () => {
    assert.equal(parseConversationIdFromAddress("not-an-email"), null);
  });

  it("returns null for empty / null / undefined", () => {
    assert.equal(parseConversationIdFromAddress(""), null);
    assert.equal(parseConversationIdFromAddress(null), null);
    assert.equal(parseConversationIdFromAddress(undefined), null);
  });
});
