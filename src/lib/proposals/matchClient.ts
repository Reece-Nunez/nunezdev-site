/**
 * Matching a client the "Draft with AI" brief names, so the proposal form can
 * auto-select them. Pure and unit-tested (no React, no network) — the form in
 * components/proposals/ProposalForm imports it.
 */

export interface MatchableClient {
  id: string;
  name: string;
  company?: string;
}

/**
 * Find a client the brief names. Matches the client's name (or company) as a
 * whole-word, case-insensitive substring of the brief and prefers the longest
 * match, so "Acme Co" wins over a stray "Co". Labels under 3 characters are
 * ignored (too short to be a safe signal). Returns '' when nothing matches, so
 * the caller keeps whatever is already selected.
 */
export function matchClientId(brief: string, clients: MatchableClient[]): string {
  const hay = (brief || "").toLowerCase();
  if (!hay.trim()) return "";

  let bestId = "";
  let bestLen = 0;
  for (const c of clients) {
    for (const label of [c.name, c.company]) {
      const needle = label?.trim().toLowerCase();
      if (!needle || needle.length < 3) continue;
      const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (re.test(hay) && needle.length > bestLen) {
        bestId = c.id;
        bestLen = needle.length;
      }
    }
  }
  return bestId;
}
