/**
 * US phone number formatting helpers.
 *
 * The DB column `clients.phone` is `text` with no constraint, so legacy rows
 * have 4 different formats living side-by-side:
 *   - "(512) 555-0142"   ← target display format
 *   - "5125550142"        ← 10 raw digits
 *   - "512-555-0142"      ← hyphenated
 *   - "+15125550142"      ← E.164 (what Twilio expects)
 *
 * `formatPhoneUS` normalizes any of those to "(XXX) XXX-XXXX" for display.
 * `formatPhoneInputAsTyped` is used in onChange to format while typing.
 *
 * For SMS sending we still call `normalizePhoneE164` from `src/lib/sms.ts`,
 * which produces the +1XXXXXXXXXX shape Twilio requires.
 */

/** Strip everything except digits. */
function digitsOnly(input: string): string {
  return input.replace(/\D+/g, '');
}

/**
 * Pull a 10-digit US number out of an arbitrary phone string.
 * Returns `null` if we can't confidently extract one (i.e. wrong digit count).
 */
function extractUSDigits(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = digitsOnly(input);
  // "+1XXXXXXXXXX" → drop the leading country code
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d.length === 10 ? d : null;
}

/**
 * Format any reasonable US phone input to "(XXX) XXX-XXXX".
 * If the input isn't recognizably a 10-digit US number, returns it unchanged
 * (so we never *hide* a value the user actually entered).
 */
export function formatPhoneUS(input: string | null | undefined): string {
  if (!input) return '';
  const d = extractUSDigits(input);
  if (!d) return input.trim();
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Progressive formatting as the user types.
 * - 0-3 digits  → "123"
 * - 4-6 digits  → "(123) 456"
 * - 7-10 digits → "(123) 456-7890"
 * - 11 digits starting with 1 → strips the 1 and formats the rest
 * - Extra digits past 10 are dropped, so the field can't exceed 14 chars.
 */
export function formatPhoneInputAsTyped(input: string): string {
  let d = digitsOnly(input);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length > 10) d = d.slice(0, 10);

  if (d.length === 0) return '';
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Returns a `tel:` href safe to use in `<a href={...}>`.
 * Uses the E.164 form when we have 10 digits (so iOS / Android route correctly
 * for international devices); falls back to the raw input otherwise.
 */
export function telHref(input: string | null | undefined): string | null {
  if (!input) return null;
  const d = extractUSDigits(input);
  return d ? `tel:+1${d}` : `tel:${input.trim()}`;
}
