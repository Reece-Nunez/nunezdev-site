/**
 * Unit tests for the shared invoice/proposal totals math. Run with:
 *
 *   npm test
 *
 * No DB, no network. These pin the cents arithmetic that both invoices and
 * proposals depend on — the part most likely to silently diverge between the
 * two and produce a proposal that totals differently from the invoice it
 * converts into.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateDocumentTotals } from "./documentTotals";

describe("calculateDocumentTotals", () => {
  it("sums line item amounts with no discount", () => {
    const t = calculateDocumentTotals([
      { amount_cents: 7500 },
      { amount_cents: 2500 },
    ]);
    assert.equal(t.subtotal_cents, 10000);
    assert.equal(t.discount_cents, 0);
    assert.equal(t.tax_cents, 0);
    assert.equal(t.total_cents, 10000);
  });

  it("applies a percentage discount and rounds to the nearest cent", () => {
    // 10% of 9999 = 999.9 -> rounds to 1000
    const t = calculateDocumentTotals([{ amount_cents: 9999 }], "percentage", 10);
    assert.equal(t.discount_cents, 1000);
    assert.equal(t.total_cents, 8999);
  });

  it("applies a fixed discount entered in dollars", () => {
    const t = calculateDocumentTotals([{ amount_cents: 10000 }], "fixed", 25);
    assert.equal(t.discount_cents, 2500);
    assert.equal(t.total_cents, 7500);
  });

  it("never lets a fixed discount drive the total negative", () => {
    const t = calculateDocumentTotals([{ amount_cents: 5000 }], "fixed", 200);
    assert.equal(t.discount_cents, 5000); // clamped to subtotal
    assert.equal(t.total_cents, 0);
  });

  it("ignores a zero or negative discount value", () => {
    assert.equal(calculateDocumentTotals([{ amount_cents: 5000 }], "fixed", 0).total_cents, 5000);
    assert.equal(calculateDocumentTotals([{ amount_cents: 5000 }], "percentage", -5).total_cents, 5000);
  });

  it("treats an unknown discount type as no discount", () => {
    const t = calculateDocumentTotals([{ amount_cents: 5000 }], "bogus", 10);
    assert.equal(t.discount_cents, 0);
    assert.equal(t.total_cents, 5000);
  });

  it("handles empty / null line items as zero", () => {
    assert.equal(calculateDocumentTotals([]).total_cents, 0);
    assert.equal(calculateDocumentTotals(null).total_cents, 0);
    assert.equal(calculateDocumentTotals(undefined).subtotal_cents, 0);
  });

  it("tolerates missing amount_cents on a line item", () => {
    const t = calculateDocumentTotals([{ amount_cents: 1000 }, {} as { amount_cents: number }]);
    assert.equal(t.subtotal_cents, 1000);
  });
});
