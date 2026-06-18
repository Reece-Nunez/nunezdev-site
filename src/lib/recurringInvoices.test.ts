/**
 * Unit tests for the billing-cadence math in recurringInvoices. Run with:
 *
 *   npm test
 *
 * calculateNextInvoiceDate decides when a client gets billed again. A wrong
 * result here means a client is double-billed, skipped, or charged on the
 * wrong day — so the month-rollover, month-end clamp, and day-of-month rules
 * are pinned explicitly. Dates are built and read with LOCAL getters so the
 * arithmetic is asserted independent of the runner's timezone.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateNextInvoiceDate, generateAccessToken } from "./recurringInvoices";

// Assert a Date lands on a given local Y/M/D (month is 1-based here for clarity).
function assertYMD(d: Date, year: number, month: number, day: number) {
  assert.equal(d.getFullYear(), year, "year");
  assert.equal(d.getMonth() + 1, month, "month");
  assert.equal(d.getDate(), day, "day");
}

describe("calculateNextInvoiceDate", () => {
  it("weekly adds 7 days", () => {
    assertYMD(calculateNextInvoiceDate(new Date(2026, 0, 1), "weekly"), 2026, 1, 8);
  });

  it("monthly (no day_of_month) advances one month, same day", () => {
    assertYMD(calculateNextInvoiceDate(new Date(2026, 0, 15), "monthly"), 2026, 2, 15);
  });

  it("monthly rolls over the year boundary", () => {
    assertYMD(calculateNextInvoiceDate(new Date(2026, 11, 15), "monthly"), 2027, 1, 15);
  });

  it("monthly with day_of_month pins to that day next month", () => {
    assertYMD(calculateNextInvoiceDate(new Date(2026, 5, 1), "monthly", 1), 2026, 7, 1);
  });

  it("monthly with day_of_month=31 clamps to the last day of a short month", () => {
    // Jan 31 + 1 month → February; Feb 2026 has 28 days → clamp to the 28th.
    assertYMD(calculateNextInvoiceDate(new Date(2026, 0, 31), "monthly", 31), 2026, 2, 28);
  });

  it("quarterly adds 3 months", () => {
    assertYMD(calculateNextInvoiceDate(new Date(2026, 0, 15), "quarterly"), 2026, 4, 15);
  });

  it("annually adds 1 year", () => {
    assertYMD(calculateNextInvoiceDate(new Date(2026, 2, 10), "annually"), 2027, 3, 10);
  });

  it("unknown frequency defaults to monthly", () => {
    assertYMD(calculateNextInvoiceDate(new Date(2026, 0, 15), "fortnightly"), 2026, 2, 15);
  });
});

describe("generateAccessToken", () => {
  it("produces an alphanumeric token of at least 33 chars (32 random + time suffix)", () => {
    const token = generateAccessToken();
    assert.match(token, /^[A-Za-z0-9]+$/);
    assert.ok(token.length >= 33, `expected >=33 chars, got ${token.length}`);
  });
});
