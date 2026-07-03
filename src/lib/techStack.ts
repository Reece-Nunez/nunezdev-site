/**
 * technology_stack lives as a comma string in proposal forms / the proposals
 * table (text) but as a text[] on the invoices table and in the invoice UI.
 * These helpers convert between the two shapes so a copy across the boundary
 * (e.g. converting a proposal to an invoice) doesn't hand Postgres a bare
 * "A, B, C" string for a text[] column — which fails with
 * "malformed array literal".
 */

/** text[]/string -> comma string (for form fields). */
export function stackToString(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string') return value;
  return '';
}

/** string/text[] -> string[] (for a text[] DB column). Empty -> []. */
export function stackToArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
