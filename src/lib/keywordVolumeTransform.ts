/**
 * Pure helpers for the Keyword Planner search-volume cache.
 *
 * NO external imports on purpose (mirrors googleAdsTransform.ts): the row
 * selection, staleness, and normalization logic below is exactly the part most
 * likely to silently drift, and keeping it dependency-free lets the unit tests
 * exercise it without constructing the gRPC `google-ads-api` client (which
 * needs real credentials).
 *
 * The client call + Supabase cache read-through live in `keywordVolume.ts`.
 */

/** Normalize a seed keyword: trim, collapse inner whitespace, lowercase. */
export function normalizeKeyword(raw: string): string {
  return (raw || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The "City, State" label a cached volume is scoped to. Drops the state when
 * absent so the key stays stable, but callers should pass state whenever they
 * have it — the same city name exists in many states and the geo lookup needs
 * it to disambiguate.
 */
export function metroLabel(city: string, state: string): string {
  const c = (city || "").trim();
  const s = (state || "").trim();
  return s ? `${c}, ${s}` : c;
}

/**
 * Sanitize a city name before interpolating it into a GAQL string literal.
 * Defence-in-depth: the city ultimately comes from campaign/business config,
 * not raw user input, but strip quotes/backslashes and cap length anyway so a
 * future caller can't inject into the geo_target_constant query.
 */
export function sanitizeGaqlLiteral(value: string): string {
  return (value || "").replace(/['"\\]/g, "").trim().slice(0, 80);
}

// Loose shape of a keyword idea row from generateKeywordIdeas — numeric fields
// arrive as number OR string depending on the field, so coerce with Number().
export interface KeywordIdeaLike {
  text?: string;
  keyword_idea_metrics?: { avg_monthly_searches?: number | string | null };
}

/**
 * Pick the monthly volume for the seed. Prefer the idea whose text exactly
 * matches the seed keyword (generateKeywordIdeas returns the seed plus many
 * related ideas, in no guaranteed order); fall back to the first idea.
 * Returns a rounded non-negative integer; 0 when there's no usable number.
 */
export function pickVolume(ideas: KeywordIdeaLike[], keyword: string): number {
  if (!Array.isArray(ideas) || ideas.length === 0) return 0;
  const kw = normalizeKeyword(keyword);
  const exact = ideas.find((i) => normalizeKeyword(i.text ?? "") === kw);
  const row = exact ?? ideas[0];
  const v = Number(row?.keyword_idea_metrics?.avg_monthly_searches ?? 0);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

// Loose shape of a geo_target_constant row.
export interface GeoTargetLike {
  geo_target_constant?: { id?: number | string; canonical_name?: string };
}

/**
 * Choose the geo-target whose canonical_name contains the state (e.g.
 * "Stillwater,Oklahoma,United States"); fall back to the first row when no
 * state match is found. Returns null only when there are no rows at all.
 */
export function pickGeoTarget(rows: GeoTargetLike[], stateName: string): GeoTargetLike | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const st = (stateName || "").toLowerCase();
  return (
    rows.find((r) =>
      (r.geo_target_constant?.canonical_name ?? "").toLowerCase().includes(st),
    ) ?? rows[0]
  );
}

/**
 * True when a cached row is older than `maxAgeDays` (or has no/invalid
 * timestamp) and should be re-fetched. `now` is passed explicitly so this
 * stays pure and testable without the clock.
 */
export function isStale(
  fetchedAt: string | null | undefined,
  now: Date,
  maxAgeDays = 30,
): boolean {
  if (!fetchedAt) return true;
  const then = new Date(fetchedAt).getTime();
  if (!Number.isFinite(then)) return true;
  return now.getTime() - then > maxAgeDays * 86_400_000;
}
