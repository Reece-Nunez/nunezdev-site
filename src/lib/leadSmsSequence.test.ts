/**
 * Unit tests for the SMS follow-up cadence (pure parts). Run with:
 *   npx tsx --test src/lib/leadSmsSequence.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderSmsTemplate,
  buildSequenceRows,
  isStopStatus,
  autoEnrollSkipReason,
  THUMBTACK_SMS_SEQUENCE,
} from "./leadSmsSequence";

describe("renderSmsTemplate", () => {
  it("fills first name, lowercased service, and links", () => {
    const out = renderSmsTemplate(
      "Hey {name}, your {service} — book: {booking} · work: {portfolio}",
      { name: "Chu Okonkwo", project_type: "Web Design" },
    );
    assert.match(out, /^Hey Chu, your web design/);
    assert.match(out, /nunezdev\.com\/book/);
    assert.match(out, /nunezdev\.com\/portfolio/);
    assert.doesNotMatch(out, /\{(name|service|booking|portfolio)\}/); // no leftover tokens
  });

  it("falls back gracefully when name/service are missing", () => {
    const out = renderSmsTemplate("Hi {name}, about your {service}.", { name: null, project_type: null });
    assert.equal(out, "Hi there, about your project.");
  });
});

describe("isStopStatus", () => {
  it("stops on converted/qualified/lost, continues otherwise", () => {
    assert.equal(isStopStatus("converted"), true);
    assert.equal(isStopStatus("qualified"), true);
    assert.equal(isStopStatus("lost"), true);
    assert.equal(isStopStatus("new"), false);
    assert.equal(isStopStatus("contacted"), false);
    assert.equal(isStopStatus(null), false);
  });
});

describe("buildSequenceRows", () => {
  it("schedules one row per step at the right offsets, rendered", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0); // fixed
    const rows = buildSequenceRows("lead-1", { name: "Jane Doe", project_type: "SEO" }, now);

    assert.equal(rows.length, THUMBTACK_SMS_SEQUENCE.length);
    assert.deepEqual(rows.map((r) => r.step), [0, 1, 2, 3, 4]);
    assert.ok(rows.every((r) => r.lead_id === "lead-1" && r.status === "pending"));

    // Offsets: step 0 == now, step at delayDays N == now + N days.
    for (const r of rows) {
      const step = THUMBTACK_SMS_SEQUENCE.find((s) => s.step === r.step)!;
      assert.equal(
        new Date(r.scheduled_for).getTime(),
        now + step.delayDays * 24 * 60 * 60 * 1000,
      );
    }
    // Rendered, not raw templates.
    assert.match(rows[0].body, /Hey Jane/);
    assert.doesNotMatch(rows[0].body, /\{name\}/);
  });

  it("step 0 carries the STOP opt-out notice", () => {
    const rows = buildSequenceRows("l", { name: "A", project_type: "x" }, Date.now());
    assert.match(rows[0].body, /Reply STOP to opt out/i);
  });
});

describe("autoEnrollSkipReason", () => {
  it("skips leads flagged low-quality by the geo screen", () => {
    assert.equal(autoEnrollSkipReason({ lowQuality: true }), "offshore");
  });

  it("skips leads already tagged 'offshore' even without the lowQuality flag", () => {
    assert.equal(autoEnrollSkipReason({ tags: ["web-design", "offshore"] }), "offshore");
  });

  it("allows normal leads through (null = eligible)", () => {
    assert.equal(autoEnrollSkipReason({ tags: ["web-design"], lowQuality: false }), null);
    assert.equal(autoEnrollSkipReason({}), null);
    assert.equal(autoEnrollSkipReason({ tags: null }), null);
  });
});
