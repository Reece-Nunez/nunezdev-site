/**
 * Thumbtack ROI — pure matching + aggregation (no DB, no React; unit-tested).
 *
 * The question: for every Thumbtack lead I paid a fee for, did it become a
 * client I did paid work for, and what's the return? We match each lead to a
 * client three ways (most→least reliable) and roll up spend vs. collected
 * revenue.
 *
 * Matching precedence per lead:
 *   1. `linked`  — an explicit lead→client link (a converted lead).
 *   2. `phone`   — the lead's phone matches a client's phone (last-10-digits).
 *   3. `name`    — the lead's normalized name matches a client's name.
 * Revenue is attributed per *distinct* matched client (all their collected
 * payments) so two leads for the same client never double-count revenue.
 */

export type MatchConfidence = "linked" | "phone" | "name";
export type LeadOutcome = "won" | "in_progress" | "unmatched";

/** One Thumbtack lead, as pulled from a NegotiationCreatedV4 event (+ any
 *  explicit link learned from the leads table). */
export interface RoiLead {
  negotiationId: string | null;
  name: string | null;
  phone: string | null;
  priceCents: number | null;
  dateISO: string | null; // YYYY-MM-DD
  /** Explicit client link (from a converted lead), if any. */
  linkedClientId?: string | null;
}

export interface RoiClient {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface RoiLeadRow {
  negotiationId: string | null;
  name: string | null;
  priceCents: number | null;
  dateISO: string | null;
  clientId: string | null;
  clientName: string | null;
  confidence: MatchConfidence | null;
  clientRevenueCents: number;
  outcome: LeadOutcome;
}

export interface ThumbtackRoi {
  leadCount: number;
  spendCents: number;
  /** Distinct clients any lead matched to. */
  matchedClientCount: number;
  /** Distinct matched clients with collected payments > 0 ("won"). */
  wonClientCount: number;
  /** Sum of collected payments across distinct matched clients. */
  revenueCents: number;
  netCents: number;
  /** revenue / spend (e.g. 3.2 = 3.2×). Null when there's no spend yet. */
  roiMultiple: number | null;
  /** (revenue − spend) / spend × 100. Null when there's no spend yet. */
  roiPct: number | null;
  /** wonClientCount / leadCount. Null when there are no leads. */
  winRate: number | null;
  avgCostPerLeadCents: number | null;
  avgRevenuePerWonCents: number | null;
  rows: RoiLeadRow[];
}

/** Digits-only, last 10 — a stable phone match key that ignores +1 and
 *  formatting. Returns null when there aren't 10 usable digits. */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Lowercase, trim, strip punctuation, collapse whitespace — for name matching. */
export function nameKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return key || null;
}

interface Matched {
  clientId: string | null;
  confidence: MatchConfidence | null;
}

/** Resolve a single lead to a client id + how confident we are. */
function matchLead(
  lead: RoiLead,
  clientById: Map<string, RoiClient>,
  clientIdByPhone: Map<string, string>,
  clientIdByName: Map<string, string>,
): Matched {
  if (lead.linkedClientId && clientById.has(lead.linkedClientId)) {
    return { clientId: lead.linkedClientId, confidence: "linked" };
  }
  const pk = phoneKey(lead.phone);
  if (pk) {
    const id = clientIdByPhone.get(pk);
    if (id) return { clientId: id, confidence: "phone" };
  }
  const nk = nameKey(lead.name);
  if (nk) {
    const id = clientIdByName.get(nk);
    if (id) return { clientId: id, confidence: "name" };
  }
  return { clientId: null, confidence: null };
}

/**
 * Compute the full ROI picture.
 *
 * @param leads               all Thumbtack leads (deduped by negotiationID upstream)
 * @param clients             all clients to match against
 * @param collectedByClientId collected (paid) cents per client id, across all their invoices
 */
export function computeThumbtackRoi(
  leads: RoiLead[],
  clients: RoiClient[],
  collectedByClientId: Record<string, number>,
): ThumbtackRoi {
  const clientById = new Map(clients.map((c) => [c.id, c]));

  // Build lookup maps. First writer wins on a collision so a match is
  // deterministic; ambiguous keys (two clients, same phone/name) just resolve
  // to whichever was seen first — acceptable for a best-effort attribution.
  const clientIdByPhone = new Map<string, string>();
  const clientIdByName = new Map<string, string>();
  for (const c of clients) {
    const pk = phoneKey(c.phone);
    if (pk && !clientIdByPhone.has(pk)) clientIdByPhone.set(pk, c.id);
    const nk = nameKey(c.name);
    if (nk && !clientIdByName.has(nk)) clientIdByName.set(nk, c.id);
  }

  const rows: RoiLeadRow[] = [];
  const matchedClientIds = new Set<string>();
  let spendCents = 0;

  for (const lead of leads) {
    spendCents += lead.priceCents ?? 0;
    const { clientId, confidence } = matchLead(lead, clientById, clientIdByPhone, clientIdByName);
    const clientRevenueCents = clientId ? collectedByClientId[clientId] ?? 0 : 0;
    if (clientId) matchedClientIds.add(clientId);

    const outcome: LeadOutcome = !clientId
      ? "unmatched"
      : clientRevenueCents > 0
        ? "won"
        : "in_progress";

    rows.push({
      negotiationId: lead.negotiationId,
      name: lead.name,
      priceCents: lead.priceCents,
      dateISO: lead.dateISO,
      clientId,
      clientName: clientId ? clientById.get(clientId)?.name ?? null : null,
      confidence,
      clientRevenueCents,
      outcome,
    });
  }

  // Revenue + wins counted over DISTINCT matched clients (no double-count when
  // two leads map to the same client).
  let revenueCents = 0;
  let wonClientCount = 0;
  for (const id of matchedClientIds) {
    const collected = collectedByClientId[id] ?? 0;
    revenueCents += collected;
    if (collected > 0) wonClientCount += 1;
  }

  const leadCount = leads.length;
  const netCents = revenueCents - spendCents;

  return {
    leadCount,
    spendCents,
    matchedClientCount: matchedClientIds.size,
    wonClientCount,
    revenueCents,
    netCents,
    roiMultiple: spendCents > 0 ? revenueCents / spendCents : null,
    roiPct: spendCents > 0 ? (netCents / spendCents) * 100 : null,
    winRate: leadCount > 0 ? wonClientCount / leadCount : null,
    avgCostPerLeadCents: leadCount > 0 ? Math.round(spendCents / leadCount) : null,
    avgRevenuePerWonCents: wonClientCount > 0 ? Math.round(revenueCents / wonClientCount) : null,
    rows,
  };
}
