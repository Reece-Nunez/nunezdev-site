/**
 * Unit tests for the proposal-draft sanitizer and the JSON extractor. Run with:
 *
 *   npm test
 *
 * No network, no Anthropic call — these pin the parsing/coercion that turns a
 * raw model response into safe form data (the part that breaks if the model
 * returns slightly-off JSON).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeProposalDraft } from "./proposalDraft";
import { extractJsonObject } from "./anthropic";

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    assert.deepEqual(extractJsonObject('{"a":1}'), { a: 1 });
  });

  it("parses JSON wrapped in a ```json code fence", () => {
    assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { a: 1 });
  });

  it("recovers JSON from surrounding preamble text", () => {
    assert.deepEqual(extractJsonObject('Sure! Here it is:\n{"a":1}\nHope that helps'), { a: 1 });
  });

  it("returns null when there is no JSON", () => {
    assert.equal(extractJsonObject("no json here"), null);
    assert.equal(extractJsonObject(""), null);
  });
});

describe("sanitizeProposalDraft", () => {
  it("coerces a well-formed draft and recomputes amounts", () => {
    const draft = sanitizeProposalDraft({
      title: "Website Redesign",
      project_overview: "We rebuild the site.",
      line_items: [
        { description: "Design", quantity: 2, rate_cents: 7500, amount_cents: 99999 }, // amount ignored, recomputed
        { description: "Build", quantity: 1, rate_cents: 150000, amount_cents: 150000 },
      ],
      terms_conditions: "50% up front.",
      technology_stack: ["Next.js", "Supabase"],
    });
    assert.ok(draft);
    assert.equal(draft.title, "Website Redesign");
    assert.equal(draft.line_items.length, 2);
    assert.equal(draft.line_items[0].amount_cents, 15000); // 2 * 7500, not the bogus 99999
    assert.deepEqual(draft.technology_stack, ["Next.js", "Supabase"]);
  });

  it("defaults a missing rate to the $75/hr house rate", () => {
    const draft = sanitizeProposalDraft({
      line_items: [{ description: "Consulting", quantity: 3 }],
    });
    assert.ok(draft);
    assert.equal(draft.line_items[0].rate_cents, 7500);
    assert.equal(draft.line_items[0].amount_cents, 22500);
  });

  it("treats a zero rate like a missing one (defaults to the house rate)", () => {
    // We can't tell an explicit 0 from an omitted field, so both default to
    // $75/hr — same behavior as the invoice generator. The user edits anyway.
    const draft = sanitizeProposalDraft({
      line_items: [{ description: "Free?", quantity: 1, rate_cents: 0 }],
    });
    assert.ok(draft);
    assert.equal(draft.line_items[0].rate_cents, 7500);
  });

  it("returns null for non-object or item-less input", () => {
    assert.equal(sanitizeProposalDraft(null), null);
    assert.equal(sanitizeProposalDraft("nope"), null);
    assert.equal(sanitizeProposalDraft({ title: "x" }), null); // no line_items
    assert.equal(sanitizeProposalDraft({ line_items: [] }), null);
    assert.equal(sanitizeProposalDraft({ line_items: ["not an object"] }), null);
  });

  it("falls back to safe defaults for missing text fields", () => {
    const draft = sanitizeProposalDraft({
      line_items: [{ description: "Work", quantity: 1, rate_cents: 5000 }],
    });
    assert.ok(draft);
    assert.equal(draft.title, "Project Proposal");
    assert.equal(draft.project_overview, "");
    assert.deepEqual(draft.technology_stack, []);
  });
});
