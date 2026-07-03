/**
 * Unit tests for the pure helpers in utils.ts. Run with:
 *
 *   npm test
 *
 * No React, no DB, no env vars touched.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aiScoreClass,
  availableStages,
  reasonLabel,
  NOT_INTERESTED_REASONS,
  filterSortProspects,
} from "./utils";
import type { BusinessSummary } from "@/lib/leadgen-db";

function biz(p: Partial<BusinessSummary>): BusinessSummary {
  return {
    id: 1, name: "Biz", address: null, phone: null, email: null, website: null,
    category: null, place_id: null, rating: null, review_count: null,
    status: "new", opportunity_score: 0, source: null, city: null, state: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    email_source: null, phone_type: null, sms_capable: null,
    archived: false, archived_at: null, archived_reason: null,
    ai_score: null, website_score: null, ...p,
  };
}

describe("filterSortProspects", () => {
  const rows = [
    biz({ id: 1, name: "Acme Plumbing", ai_score: 9, email: "a@acme.com", city: "Provo", review_count: 50, rating: 4.5 }),
    biz({ id: 2, name: "Bob's Bakery", ai_score: 4, email: null, city: "Provo", review_count: 10, rating: 4.9 }),
    biz({ id: 3, name: "Carl Cleaning", ai_score: null, email: "c@carl.com", city: "Orem", review_count: 200, rating: 3.8 }),
  ];

  it("filters to leads with an email", () => {
    const out = filterSortProspects(rows, { email: "has" });
    assert.deepEqual(out.map((b) => b.id).sort(), [1, 3]);
  });

  it("filters to leads with no email", () => {
    const out = filterSortProspects(rows, { email: "none" });
    assert.deepEqual(out.map((b) => b.id), [2]);
  });

  it("sorts AI score high → low, un-scored last", () => {
    const out = filterSortProspects(rows, { sort: "ai_desc" });
    assert.deepEqual(out.map((b) => b.id), [1, 2, 3]); // 9, 4, null
  });

  it("sorts AI score low → high, un-scored still last (not first)", () => {
    const out = filterSortProspects(rows, { sort: "ai_asc" });
    assert.deepEqual(out.map((b) => b.id), [2, 1, 3]); // 4, 9, null
  });

  it("sorts by most reviews", () => {
    const out = filterSortProspects(rows, { sort: "reviews_desc" });
    assert.deepEqual(out.map((b) => b.id), [3, 1, 2]); // 200, 50, 10
  });

  it("searches across name + city (case-insensitive)", () => {
    assert.deepEqual(filterSortProspects(rows, { search: "bakery" }).map((b) => b.id), [2]);
    assert.deepEqual(filterSortProspects(rows, { search: "orem" }).map((b) => b.id), [3]);
  });

  it("filters by city", () => {
    assert.deepEqual(filterSortProspects(rows, { city: "Provo", sort: "ai_desc" }).map((b) => b.id), [1, 2]);
  });

  it("filters to mobile phone numbers only", () => {
    const phoneRows = [
      biz({ id: 1, phone_type: "mobile" }),
      biz({ id: 2, phone_type: "landline" }),
      biz({ id: 3, phone_type: null }),
      biz({ id: 4, phone_type: "mobile" }),
    ];
    assert.deepEqual(
      filterSortProspects(phoneRows, { mobile: "mobile" }).map((b) => b.id).sort(),
      [1, 4],
    );
  });

  it("filters to non-mobile (landline, voip, and un-looked-up null)", () => {
    const phoneRows = [
      biz({ id: 1, phone_type: "mobile" }),
      biz({ id: 2, phone_type: "landline" }),
      biz({ id: 3, phone_type: null }),
      biz({ id: 4, phone_type: "voip" }),
    ];
    assert.deepEqual(
      filterSortProspects(phoneRows, { mobile: "not_mobile" }).map((b) => b.id).sort(),
      [2, 3, 4],
    );
  });

  it("filters to not-yet-contacted leads (excludes contacted/replied/converted)", () => {
    const statusRows = [
      biz({ id: 1, status: "new" }),
      biz({ id: 2, status: "proposal_built" }),
      biz({ id: 3, status: "contacted" }),
      biz({ id: 4, status: "replied" }),
      biz({ id: 5, status: "converted" }),
      biz({ id: 6, status: "not_interested" }),
    ];
    assert.deepEqual(
      filterSortProspects(statusRows, { contacted: "no" }).map((b) => b.id).sort(),
      [1, 2, 6], // new, proposal_built, not_interested haven't been sent outreach
    );
  });

  it("filters to already-contacted leads", () => {
    const statusRows = [
      biz({ id: 1, status: "new" }),
      biz({ id: 2, status: "contacted" }),
      biz({ id: 3, status: "replied" }),
      biz({ id: 4, status: "converted" }),
    ];
    assert.deepEqual(
      filterSortProspects(statusRows, { contacted: "yes" }).map((b) => b.id).sort(),
      [2, 3, 4],
    );
  });

  it("contacted 'all' (default) leaves the status mix untouched", () => {
    const statusRows = [biz({ id: 1, status: "new" }), biz({ id: 2, status: "contacted" })];
    assert.deepEqual(filterSortProspects(statusRows, {}).map((b) => b.id).sort(), [1, 2]);
  });
});

describe("aiScoreClass", () => {
  it("returns the null/unknown class when score is null or undefined", () => {
    assert.equal(aiScoreClass(null), "bg-gray-50 text-gray-500 border-gray-200");
    assert.equal(aiScoreClass(undefined), "bg-gray-50 text-gray-500 border-gray-200");
  });

  it("maps 9-10 to red (high-conviction lead)", () => {
    assert.match(aiScoreClass(9), /bg-red-50/);
    assert.match(aiScoreClass(10), /bg-red-50/);
  });

  it("maps 7-8 to orange", () => {
    assert.match(aiScoreClass(7), /bg-orange-50/);
    assert.match(aiScoreClass(8), /bg-orange-50/);
  });

  it("maps 5-6 to yellow", () => {
    assert.match(aiScoreClass(5), /bg-yellow-50/);
    assert.match(aiScoreClass(6), /bg-yellow-50/);
  });

  it("maps 3-4 to blue", () => {
    assert.match(aiScoreClass(3), /bg-blue-50/);
    assert.match(aiScoreClass(4), /bg-blue-50/);
  });

  it("maps 0-2 to muted gray", () => {
    assert.equal(aiScoreClass(0), "bg-gray-50 text-gray-600 border-gray-200");
    assert.equal(aiScoreClass(2), "bg-gray-50 text-gray-600 border-gray-200");
  });

  it("treats the boundary at >=, not >", () => {
    // 9 must be red (not orange); 7 must be orange (not yellow); etc.
    assert.match(aiScoreClass(9), /bg-red-50/);
    assert.match(aiScoreClass(8.999), /bg-orange-50/);
    assert.match(aiScoreClass(7), /bg-orange-50/);
    assert.match(aiScoreClass(6.999), /bg-yellow-50/);
  });
});

describe("availableStages", () => {
  it("'new' allows only research", () => {
    assert.deepEqual(availableStages("new"), ["research"]);
  });

  it("'researched' allows research + build (re-run upstream OK)", () => {
    assert.deepEqual(availableStages("researched"), ["research", "build"]);
  });

  it("'proposal_built' unlocks the outreach stage", () => {
    assert.deepEqual(availableStages("proposal_built"), ["research", "build", "outreach"]);
  });

  it("'contacted' still allows every stage (can re-run after contact)", () => {
    // Once contacted, the user may want to re-research (website changed)
    // or re-build (new mockup approach) — gating those would be hostile.
    assert.deepEqual(availableStages("contacted"), ["research", "build", "outreach"]);
  });

  it("preserves stage ordering: research before build before outreach", () => {
    // Several UI affordances assume the array order matches pipeline order
    // (left-to-right in the button row). Pin that down.
    const stages = availableStages("contacted");
    assert.equal(stages.indexOf("research") < stages.indexOf("build"), true);
    assert.equal(stages.indexOf("build") < stages.indexOf("outreach"), true);
  });

  it("'not_interested' offers no stages until reopened", () => {
    // Mirrors the pipeline-side send guard — a declined lead is dormant, so
    // the UI must not surface stage actions the API would reject.
    assert.deepEqual(availableStages("not_interested"), []);
  });

  it("'replied' allows every stage (hot lead, can rebuild/re-pitch)", () => {
    // A reply is the warmest signal — the operator may want to regenerate
    // outreach or rebuild the proposal mid-conversation, so keep all stages.
    assert.deepEqual(availableStages("replied"), ["research", "build", "outreach"]);
  });

  it("'converted' offers no stages (handed off to the CRM)", () => {
    assert.deepEqual(availableStages("converted"), []);
  });
});

describe("reasonLabel", () => {
  it("returns empty string for null/undefined", () => {
    assert.equal(reasonLabel(null), "");
    assert.equal(reasonLabel(undefined), "");
  });

  it("maps a known reason code to its human label", () => {
    assert.equal(reasonLabel("too_expensive"), "Too expensive");
    assert.equal(reasonLabel("do_not_contact"), "Do not contact");
  });

  it("every reason option has a non-empty label and unique value", () => {
    const values = NOT_INTERESTED_REASONS.map((r) => r.value);
    assert.equal(new Set(values).size, values.length, "values must be unique");
    for (const r of NOT_INTERESTED_REASONS) {
      assert.equal(reasonLabel(r.value), r.label);
      assert.equal(r.label.length > 0, true);
    }
  });
});
