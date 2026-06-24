/**
 * Unit tests for resolveDisplayName. Run with:
 *
 *   npm test
 *
 * The inbox cross-references a conversation's phone/email against clients/leads
 * so a known contact shows their name, not a bare number. These pin the match
 * rules: E.164 normalization (so "(503) 710-7584" on a client matches a thread
 * stored as "+15037107584"), case-insensitive email, and phone-before-email.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveDisplayName, type ContactNameMaps } from "./inboxContacts";

const maps: ContactNameMaps = {
  byPhone: new Map([["+15037107584", "Aaron Rian"]]),
  byEmail: new Map([["chris@pinto.com", "Chris Pinto"]]),
};

describe("resolveDisplayName", () => {
  it("matches an SMS thread by normalized phone", () => {
    assert.equal(resolveDisplayName(maps, { contact_phone: "+15037107584" }), "Aaron Rian");
  });

  it("matches an email thread case-insensitively", () => {
    assert.equal(resolveDisplayName(maps, { contact_email: "Chris@Pinto.com" }), "Chris Pinto");
  });

  it("returns null when nothing matches", () => {
    assert.equal(resolveDisplayName(maps, { contact_phone: "+19998887777" }), null);
    assert.equal(resolveDisplayName(maps, { contact_email: "stranger@nope.com" }), null);
    assert.equal(resolveDisplayName(maps, {}), null);
  });

  it("prefers a phone match over an email match", () => {
    const m: ContactNameMaps = {
      byPhone: new Map([["+15037107584", "Phone Name"]]),
      byEmail: new Map([["x@y.com", "Email Name"]]),
    };
    assert.equal(
      resolveDisplayName(m, { contact_phone: "+15037107584", contact_email: "x@y.com" }),
      "Phone Name",
    );
  });
});
