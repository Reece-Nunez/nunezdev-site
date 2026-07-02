// Server-side spam screening for public contact/lead submissions.
//
// Turnstile (see lib/turnstile.ts) blocks automated bots, but it can't stop a
// human — or a bot that solved the challenge — from submitting junk. This
// module screens the *content* of a submission with high-precision, low-recall
// rules: every rule is tuned to never reject a real lead, even at the cost of
// letting some junk through. A false negative is an unwanted email; a false
// positive is a lost customer, so we bias hard toward the customer.
//
// Reasons are returned (not just a boolean) so the caller can decide how to
// respond per case — e.g. surface a "fix your email" message for a typo, but
// silently swallow honeypot/gibberish hits so bots get no feedback.

export type LeadScreenInput = {
  name?: string | null;
  email?: string | null;
  // Hidden honeypot field. Real users never see or fill it; bots that
  // auto-fill every input give themselves away.
  honeypot?: string | null;
};

export type LeadScreenReason = "honeypot" | "invalid-email" | "gibberish-name";

export type LeadScreenResult =
  | { spam: false }
  | { spam: true; reason: LeadScreenReason };

// Structural email check — intentionally permissive (not full RFC 5322). We
// only require local@domain.tld shape, which is enough to reject the common
// junk ("how.com8y.comun.com" has no @) without bouncing valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// High-precision keyboard-mashing detector for the NAME field. Names are
// short and varied worldwide (Ng, José, Krzysztof, Nguyễn), so we only flag
// patterns that real names essentially never produce:
//
//   1. A single character dominating the string ("aaaaaa", "Jaaaaan").
//   2. A long string with very few distinct letters ("Yvyvuvyvyv" — 3 unique
//      letters across 10, a 0.3 diversity ratio no real 8+ char name reaches).
//
// Both thresholds were checked against a spread of real global names to
// confirm zero false positives; see leadSpamFilter.test.ts.
export function looksLikeMashing(value: string): boolean {
  const s = value.toLowerCase().replace(/[^a-z]/g, "");
  // Too short to judge — "Ng", "Xu", "Anna" must always pass.
  if (s.length < 5) return false;

  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);

  // Rule 1: one character is 60%+ of the letters.
  const maxFreq = Math.max(...counts.values());
  if (maxFreq / s.length >= 0.6) return true;

  // Rule 2: 8+ chars but 34% or fewer are distinct.
  if (s.length >= 8 && counts.size / s.length <= 0.34) return true;

  return false;
}

export function screenLead(input: LeadScreenInput): LeadScreenResult {
  // Honeypot first — cheapest, and a filled honeypot means we don't trust any
  // other field anyway.
  if ((input.honeypot ?? "").trim() !== "") {
    return { spam: true, reason: "honeypot" };
  }

  if (!isValidEmail(input.email ?? "")) {
    return { spam: true, reason: "invalid-email" };
  }

  if (looksLikeMashing(input.name ?? "")) {
    return { spam: true, reason: "gibberish-name" };
  }

  return { spam: false };
}
