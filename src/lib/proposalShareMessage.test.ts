/**
 * Unit tests for the proposal SMS share-message builder. Run: npm test
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildProposalShareMessage } from "./proposalShareMessage";

describe("buildProposalShareMessage", () => {
  const url = "https://www.nunezdev.com/proposal/abc123";

  it("includes greeting, title, amount, and the link", () => {
    const msg = buildProposalShareMessage({
      clientName: "Acme Co",
      proposalTitle: "Website Redesign",
      amountCents: 350000,
      url,
    });
    assert.match(msg, /^Hi Acme Co, /);
    assert.ok(msg.includes("Website Redesign"));
    assert.ok(msg.includes("$3,500.00"));
    assert.ok(msg.includes(url));
  });

  it("omits the greeting when there is no client name", () => {
    const msg = buildProposalShareMessage({ clientName: null, proposalTitle: "X", amountCents: 100, url });
    assert.ok(!msg.startsWith("Hi "));
    assert.ok(msg.includes(url));
  });

  it("falls back to a generic phrase when there is no title", () => {
    const msg = buildProposalShareMessage({ clientName: "Bo", proposalTitle: null, amountCents: 5000, url });
    assert.ok(msg.includes("your proposal ($50.00)"));
    assert.ok(msg.includes(url));
  });

  it("never uses em or en dashes (house style)", () => {
    const msg = buildProposalShareMessage({ clientName: "Acme", proposalTitle: "Site", amountCents: 100, url });
    assert.ok(!/[—–]/.test(msg));
  });
});
