import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stackToArray, stackToString } from "./techStack";

describe("stackToArray", () => {
  it("splits a comma string into a trimmed array (the convert-to-invoice bug)", () => {
    // proposals.technology_stack is text; invoices.technology_stack is text[].
    // A raw "A, B, C" string caused: malformed array literal.
    assert.deepEqual(
      stackToArray("Next.js, Tailwind CSS, Vercel, YouTube embed, Email form handler"),
      ["Next.js", "Tailwind CSS", "Vercel", "YouTube embed", "Email form handler"],
    );
  });

  it("passes an existing array through, trimming and dropping blanks", () => {
    assert.deepEqual(stackToArray(["Next.js", " Supabase ", ""]), ["Next.js", "Supabase"]);
  });

  it("returns [] for null / undefined / empty string", () => {
    assert.deepEqual(stackToArray(null), []);
    assert.deepEqual(stackToArray(undefined), []);
    assert.deepEqual(stackToArray("   "), []);
  });
});

describe("stackToString", () => {
  it("joins an array with commas", () => {
    assert.equal(stackToString(["Next.js", "Supabase"]), "Next.js, Supabase");
  });

  it("passes a string through and coerces other types to empty", () => {
    assert.equal(stackToString("Next.js"), "Next.js");
    assert.equal(stackToString(null), "");
  });
});
