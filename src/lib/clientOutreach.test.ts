/**
 * Unit tests for client outreach templates. Run with: npm test
 * Pins the no-em-dash house rule, name personalization, and the review link.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GOOGLE_REVIEW_URL } from "./contact";
import { carePlanEmailHtml, reviewRequestSms, reviewRequestEmailHtml } from "./clientOutreach";

describe("client outreach templates", () => {
  it("never use em or en dashes", () => {
    for (const out of [
      carePlanEmailHtml("Jane Smith"),
      reviewRequestSms("Jane Smith"),
      reviewRequestEmailHtml("Jane Smith"),
    ]) {
      assert.ok(!out.includes("—"), "em dash found");
      assert.ok(!out.includes("–"), "en dash found");
    }
  });

  it("personalize with the first name and fall back to 'there'", () => {
    assert.match(reviewRequestSms("Jane Smith"), /Hi Jane,/);
    assert.match(reviewRequestSms(null), /Hi there,/);
    assert.match(carePlanEmailHtml("Bob"), /Hi Bob,/);
  });

  it("include the Google review link in both review templates", () => {
    assert.ok(reviewRequestSms("Jane").includes(GOOGLE_REVIEW_URL));
    assert.ok(reviewRequestEmailHtml("Jane").includes(GOOGLE_REVIEW_URL));
  });

  it("care-plan email pitches all three tiers", () => {
    const html = carePlanEmailHtml("Jane");
    assert.match(html, /\$49/);
    assert.match(html, /\$199/);
    assert.match(html, /\$499/);
  });
});
