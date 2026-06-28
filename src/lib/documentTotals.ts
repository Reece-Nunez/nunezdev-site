/**
 * Shared money math for "documents" that carry line items + an optional
 * discount: invoices and proposals. Both used to keep their own copy of this
 * arithmetic (four near-identical functions), which is exactly how a proposal
 * and the invoice it converts into can silently drift to different totals.
 * One implementation, one place to fix.
 *
 * Everything is in integer cents — never floats — so totals stay exact.
 */

/** The only field the totals math needs from a line item. */
export interface DocumentLineItemAmount {
  amount_cents: number;
}

export type DiscountType = "percentage" | "fixed";

export interface DocumentTotals {
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  /**
   * Sum after discount. The `invoices` table stores this as `total_cents`-style
   * math but the column is `amount_cents`; `proposals.amount_cents` is the same
   * value. Callers map this onto whichever column name their table uses.
   */
  total_cents: number;
}

export function calculateDocumentTotals(
  line_items: DocumentLineItemAmount[] | null | undefined,
  discount_type?: string | null,
  discount_value?: number | null,
): DocumentTotals {
  const subtotal_cents = (line_items ?? []).reduce(
    (sum, item) => sum + (item?.amount_cents || 0),
    0,
  );

  let discount_cents = 0;
  if (discount_value && discount_value > 0) {
    if (discount_type === "percentage") {
      discount_cents = Math.round(subtotal_cents * (discount_value / 100));
    } else if (discount_type === "fixed") {
      // discount_value is entered in dollars for a fixed discount.
      discount_cents = Math.round(discount_value * 100);
    }
  }

  // A discount can never exceed the subtotal — otherwise a fixed discount
  // larger than the bill produces a negative total (and a nonsensical invoice).
  discount_cents = Math.min(discount_cents, subtotal_cents);

  // Tax is intentionally 0: there is no per-client tax configuration yet.
  // Kept as a field so adding it later is a one-line change here, not a hunt
  // across every call site.
  const tax_cents = 0;
  const total_cents = subtotal_cents + tax_cents - discount_cents;

  return { subtotal_cents, tax_cents, discount_cents, total_cents };
}
