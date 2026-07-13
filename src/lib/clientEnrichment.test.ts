/**
 * Unit tests for clientEnrichmentFromSigner — backfilling a CRM client profile
 * from proposal signer info. Run: npm test
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientEnrichmentFromSigner } from "./clientEnrichment";

describe("clientEnrichmentFromSigner", () => {
  it("fills email + full name for a lead-stub client (the Jamie C. case)", () => {
    assert.deepEqual(
      clientEnrichmentFromSigner(
        { name: "Jamie C.", email: null },
        { name: "Jamie Yolanda Cannady", email: "jamie@example.com" },
      ),
      { email: "jamie@example.com", name: "Jamie Yolanda Cannady" },
    );
  });

  it("also treats 'First L' (no period) as a stub", () => {
    assert.deepEqual(
      clientEnrichmentFromSigner({ name: "Jamie C", email: null }, { name: "Jamie Cannady" }),
      { name: "Jamie Cannady" },
    );
  });

  it("never overwrites an existing client email", () => {
    assert.deepEqual(
      clientEnrichmentFromSigner(
        { name: "Jamie C.", email: "billing@corp.com" },
        { name: "Jamie Cannady", email: "personal@gmail.com" },
      ),
      { name: "Jamie Cannady" }, // name upgraded, email left alone
    );
  });

  it("never clobbers a real full name", () => {
    assert.deepEqual(
      clientEnrichmentFromSigner(
        { name: "Acme Corporation", email: null },
        { name: "Bob Smith", email: "bob@acme.com" },
      ),
      { email: "bob@acme.com" }, // email backfilled, name untouched
    );
  });

  it("fills both when the client profile is empty", () => {
    assert.deepEqual(
      clientEnrichmentFromSigner({}, { name: "Dana Lee", email: "dana@x.com" }),
      { email: "dana@x.com", name: "Dana Lee" },
    );
  });

  it("returns an empty patch when nothing needs updating", () => {
    assert.deepEqual(
      clientEnrichmentFromSigner(
        { name: "Jamie Cannady", email: "jamie@x.com" },
        { name: "Jamie Cannady", email: "jamie@x.com" },
      ),
      {},
    );
  });

  it("ignores blank/whitespace signer values and trims real ones", () => {
    assert.deepEqual(
      clientEnrichmentFromSigner({ name: "Jamie C.", email: "" }, { name: "  ", email: "   " }),
      {},
    );
    assert.deepEqual(
      clientEnrichmentFromSigner({ name: "Jamie C.", email: null }, { email: "  jamie@x.com  " }),
      { email: "jamie@x.com" },
    );
  });

  it("does not treat a single first name as a stub (won't overwrite)", () => {
    assert.deepEqual(
      clientEnrichmentFromSigner({ name: "Jamie", email: null }, { name: "Jamie Cannady" }),
      {},
    );
  });
});
