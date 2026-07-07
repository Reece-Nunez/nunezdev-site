/**
 * Unit tests for the pure "answered?" helpers in leadgenInbox.ts. Run with:
 *
 *   npm test
 *
 * No DB — countUnansweredReplyLeads (the Supabase fan-out) is exercised in
 * integration, not here. These pin the decision logic the banner relies on.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isReplyAnswered,
  contactKeys,
  countUnansweredReplies,
  type RepliedContact,
  type ContactActivity,
} from "@/lib/leadgenInbox";

describe("isReplyAnswered", () => {
  it("is unanswered when there's no outbound at all", () => {
    assert.equal(isReplyAnswered({ lastInbound: 100, lastOutbound: null }), false);
    assert.equal(isReplyAnswered({ lastInbound: null, lastOutbound: null }), false);
  });

  it("is answered when we replied after the last inbound", () => {
    assert.equal(isReplyAnswered({ lastInbound: 100, lastOutbound: 200 }), true);
  });

  it("treats an outbound at the same instant as answered", () => {
    assert.equal(isReplyAnswered({ lastInbound: 100, lastOutbound: 100 }), true);
  });

  it("is unanswered when they texted again after our last reply", () => {
    assert.equal(isReplyAnswered({ lastInbound: 300, lastOutbound: 200 }), false);
  });

  it("counts an outbound with no inbound on record as answered", () => {
    assert.equal(isReplyAnswered({ lastInbound: null, lastOutbound: 200 }), true);
  });
});

describe("contactKeys", () => {
  it("normalizes a formatted US phone to E.164", () => {
    assert.deepEqual(
      contactKeys({ id: 1, phone: "(405) 762-3078", email: null }),
      ["+14057623078"],
    );
  });

  it("lowercases the email and includes both keys", () => {
    assert.deepEqual(
      contactKeys({ id: 1, phone: "4057623078", email: "Spa@Example.com" }),
      ["+14057623078", "spa@example.com"],
    );
  });

  it("drops an un-normalizable phone and a blank email", () => {
    assert.deepEqual(contactKeys({ id: 1, phone: "123", email: "   " }), []);
  });
});

describe("countUnansweredReplies", () => {
  const contact = (p: Partial<RepliedContact>): RepliedContact => ({
    id: 1,
    phone: null,
    email: null,
    ...p,
  });
  const act = (i: number | null, o: number | null): ContactActivity => ({
    lastInbound: i,
    lastOutbound: o,
  });

  it("counts a contact with no matching thread as unanswered", () => {
    const contacts = [contact({ id: 1, phone: "4057623078" })];
    assert.equal(countUnansweredReplies(contacts, new Map()), 1);
  });

  it("does not count a lead we've answered by SMS", () => {
    const contacts = [contact({ id: 1, phone: "4057623078" })];
    const activity = new Map([["+14057623078", act(100, 200)]]);
    assert.equal(countUnansweredReplies(contacts, activity), 0);
  });

  it("counts a lead who texted back after our reply", () => {
    const contacts = [contact({ id: 1, phone: "4057623078" })];
    const activity = new Map([["+14057623078", act(300, 200)]]);
    assert.equal(countUnansweredReplies(contacts, activity), 1);
  });

  it("matches a lead by email when it has no phone thread", () => {
    const contacts = [contact({ id: 1, email: "spa@example.com" })];
    const activity = new Map([["spa@example.com", act(100, 200)]]);
    assert.equal(countUnansweredReplies(contacts, activity), 0);
  });

  it("merges phone + email threads — answered on either clears it", () => {
    // Phone thread still awaits a reply, but we answered via email later.
    const contacts = [contact({ id: 1, phone: "4057623078", email: "spa@example.com" })];
    const activity = new Map([
      ["+14057623078", act(300, null)],
      ["spa@example.com", act(100, 400)],
    ]);
    // Merged: lastInbound=300, lastOutbound=400 → answered.
    assert.equal(countUnansweredReplies(contacts, activity), 0);
  });

  it("tallies a mixed batch", () => {
    const contacts = [
      contact({ id: 1, phone: "4057623078" }), // answered
      contact({ id: 2, phone: "4055551234" }), // they replied again → unanswered
      contact({ id: 3, phone: "4059998888" }), // no thread → unanswered
    ];
    const activity = new Map([
      ["+14057623078", act(100, 200)],
      ["+14055551234", act(300, 200)],
    ]);
    assert.equal(countUnansweredReplies(contacts, activity), 2);
  });
});
