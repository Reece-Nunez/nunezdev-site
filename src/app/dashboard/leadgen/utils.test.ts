/**
 * Unit tests for the pure helpers in utils.ts. Run with:
 *
 *   npm test
 *
 * No React, no DB, no env vars touched.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aiScoreClass, availableStages } from "./utils";

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
});
