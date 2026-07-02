/**
 * Unit tests for public-submission spam screening. Run with:
 *
 *   npm test
 *
 * The overriding invariant here is NO FALSE POSITIVES on real leads: a
 * mistakenly-rejected submission is a lost customer. The "real names" and
 * "real submissions" suites pin that invariant so a future threshold tweak
 * can't silently start dropping legitimate people.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidEmail, looksLikeMashing, screenLead } from "./leadSpamFilter";

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    for (const email of [
      "jane@business.com",
      "jane.doe@sub.example.co.uk",
      "j+tag@gmail.com",
      "reece@nunezdev.com",
    ]) {
      assert.equal(isValidEmail(email), true, email);
    }
  });

  it("rejects the reported junk and other malformed input", () => {
    for (const email of [
      "how.com8y.comun.com", // the actual spam lead — no @
      "notanemail",
      "missing@tld",
      "@nolocal.com",
      "spaces in@email.com",
      "",
    ]) {
      assert.equal(isValidEmail(email), false, email);
    }
  });
});

describe("looksLikeMashing", () => {
  it("flags keyboard mashing", () => {
    for (const name of [
      "Yvyvuvyvyv", // the actual spam lead's name
      "aaaaaa",
      "Jaaaaaan",
      "asdfasdfasdf",
    ]) {
      assert.equal(looksLikeMashing(name), true, name);
    }
  });

  it("never flags real names, including short and non-English ones", () => {
    for (const name of [
      "Ng",
      "Xu",
      "Anna",
      "Emma",
      "Hanna",
      "Emmett",
      "José",
      "Nguyen",
      "Schmidt",
      "Krzysztof",
      "Aleksandra",
      "Srinivasan",
      "O'Brien",
      "Mary Jane",
      "Jean-Luc",
    ]) {
      assert.equal(looksLikeMashing(name), false, name);
    }
  });
});

describe("screenLead", () => {
  const good = {
    name: "Jane Doe",
    email: "jane@business.com",
    honeypot: "",
  };

  it("passes a legitimate submission", () => {
    assert.deepEqual(screenLead(good), { spam: false });
  });

  it("blocks a filled honeypot before anything else", () => {
    assert.deepEqual(
      screenLead({ ...good, honeypot: "http://spam.example" }),
      { spam: true, reason: "honeypot" },
    );
  });

  it("blocks an invalid email", () => {
    assert.deepEqual(
      screenLead({ ...good, email: "how.com8y.comun.com" }),
      { spam: true, reason: "invalid-email" },
    );
  });

  it("blocks a gibberish name", () => {
    assert.deepEqual(
      screenLead({ ...good, name: "Yvyvuvyvyv" }),
      { spam: true, reason: "gibberish-name" },
    );
  });

  it("rejects the exact reported lead", () => {
    assert.deepEqual(
      screenLead({ name: "Yvyvuvyvyv", email: "how.com8y.comun.com", honeypot: "" }),
      // invalid-email is checked before the name, so that's the reason surfaced.
      { spam: true, reason: "invalid-email" },
    );
  });

  it("tolerates missing/undefined fields", () => {
    assert.deepEqual(screenLead({ email: "jane@business.com" }), { spam: false });
  });
});
