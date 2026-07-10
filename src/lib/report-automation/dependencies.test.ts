/**
 * Unit tests for the Dependabot severity interpretation. Run with:
 *
 *   npm test
 *
 * No network — these pin how open alerts roll up to a pass/fail verdict and
 * recommendation. The fetch itself (fetchDependabotAlerts) is a thin API shell
 * and is not unit-tested, mirroring runPSI / the hosting fetch.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeAlerts, dependencyVerdict, type DependabotAlert } from "./dependencies";

function alert(severity: string): DependabotAlert {
  return { security_advisory: { severity } };
}

describe("summarizeAlerts", () => {
  it("counts by severity and maps GitHub's 'medium' to moderate", () => {
    const s = summarizeAlerts([alert("critical"), alert("high"), alert("high"), alert("medium"), alert("low")]);
    assert.deepEqual(s, { critical: 1, high: 2, moderate: 1, low: 1, total: 5 });
  });

  it("falls back to security_vulnerability severity when advisory is absent", () => {
    const s = summarizeAlerts([{ security_vulnerability: { severity: "critical" } }]);
    assert.equal(s.critical, 1);
    assert.equal(s.total, 1);
  });

  it("ignores unknown / null severities rather than counting them", () => {
    const s = summarizeAlerts([alert("unknown"), { security_advisory: { severity: null } }, {}]);
    assert.equal(s.total, 0);
  });
});

describe("dependencyVerdict", () => {
  it("fails on any critical or high, and names the counts", () => {
    const v = dependencyVerdict({ critical: 2, high: 1, moderate: 0, low: 0, total: 3 });
    assert.equal(v.outcome, "fail");
    assert.match(v.detail, /2 critical, 1 high/);
    assert.match(v.recommendation ?? "", /need patching/);
  });

  it("uses the singular 'vulnerability' when exactly one critical/high", () => {
    const v = dependencyVerdict({ critical: 0, high: 1, moderate: 0, low: 0, total: 1 });
    assert.match(v.recommendation ?? "", /vulnerability need/);
  });

  it("passes (not red) when only moderate/low are open, and surfaces them", () => {
    const v = dependencyVerdict({ critical: 0, high: 0, moderate: 3, low: 2, total: 5 });
    assert.equal(v.outcome, "pass");
    assert.match(v.detail, /3 moderate, 2 low \(no critical\/high\)/);
    assert.equal(v.recommendation, undefined);
  });

  it("passes cleanly with no alerts", () => {
    const v = dependencyVerdict({ critical: 0, high: 0, moderate: 0, low: 0, total: 0 });
    assert.equal(v.outcome, "pass");
    assert.match(v.detail, /no known vulnerabilities/);
  });
});
