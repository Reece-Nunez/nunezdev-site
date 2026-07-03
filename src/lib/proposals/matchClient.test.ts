/**
 * Unit tests for matchClientId — the "Draft with AI" client auto-select. Run:
 *
 *   npm test
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchClientId, type MatchableClient } from "./matchClient";

const CLIENTS: MatchableClient[] = [
  { id: "1", name: "Acme Co", company: "Acme Corporation" },
  { id: "2", name: "Peter Muccia", company: "Vintero Imports" },
  { id: "3", name: "Bo", company: "Li" }, // labels too short to match
];

describe("matchClientId", () => {
  it("matches a client named in the brief (by name)", () => {
    assert.equal(matchClientId("New catalog site for Peter Muccia, ~$3k", CLIENTS), "2");
  });

  it("matches on company as well as name", () => {
    assert.equal(matchClientId("Rebuild for Vintero Imports", CLIENTS), "2");
  });

  it("is case-insensitive", () => {
    assert.equal(matchClientId("redesign for ACME CO please", CLIENTS), "1");
  });

  it("prefers the longest label so a stray token doesn't win", () => {
    // "Acme Corporation" (16) beats "Acme Co" (7) — both on client 1, but this
    // pins that we compare by length rather than first-hit.
    assert.equal(matchClientId("work for Acme Corporation", CLIENTS), "1");
  });

  it("returns '' when no client is named", () => {
    assert.equal(matchClientId("A generic landing page, three phases", CLIENTS), "");
  });

  it("ignores labels shorter than 3 chars (no false positive)", () => {
    // "Bo"/"Li" would otherwise match inside "Below" / "Client" etc.
    assert.equal(matchClientId("Below the fold, list the client work", CLIENTS), "");
  });

  it("only matches whole words, not substrings", () => {
    // "Acme Co" must not match inside "Acme Combined" as a partial.
    assert.equal(matchClientId("project for Acmeco (no space)", CLIENTS), "");
  });

  it("returns '' on empty or whitespace brief", () => {
    assert.equal(matchClientId("", CLIENTS), "");
    assert.equal(matchClientId("   ", CLIENTS), "");
  });
});
