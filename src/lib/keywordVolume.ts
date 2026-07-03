/**
 * Keyword Planner search-volume, cached read-through.
 *
 * getKeywordVolume(keyword, city, state) returns the average monthly search
 * volume for a trade keyword in a metro — the number behind the outreach
 * "~N people a month search for a {trade} around {city}" line. It serves from
 * the keyword_search_volume Supabase cache (see the migration of the same name)
 * and only hits the Google Ads API on a miss or a stale (>30-day) row, then
 * writes the fresh number back.
 *
 * Consumed server-side by /api/keyword-volume, which the leadgen pipeline calls
 * while generating outreach copy. Pure selection/staleness helpers live in
 * keywordVolumeTransform.ts (unit-tested there).
 */
import "server-only";
import { enums } from "google-ads-api";
import { supabaseAdmin } from "./supabaseAdmin";
import { getCustomer, configuredCustomerId, isConfigured } from "./googleAds";
import {
  normalizeKeyword,
  metroLabel,
  sanitizeGaqlLiteral,
  pickVolume,
  pickGeoTarget,
  isStale,
  type GeoTargetLike,
  type KeywordIdeaLike,
} from "./keywordVolumeTransform";

/** How long a cached number stays fresh. Search volume barely moves month to
 *  month, and each miss costs two API calls, so refresh roughly monthly. */
const CACHE_MAX_AGE_DAYS = 30;

export interface KeywordVolume {
  keyword: string; // normalized seed
  metro: string; // "City, State"
  volume: number; // avg monthly searches; 0 = unknown/no data (callers omit the line)
  geoTargetId: string | null; // resolved geoTargetConstants/<id>
  fetchedAt: string; // ISO timestamp of the underlying Google number
  cached: boolean; // true = served from cache, false = fetched live this call
}

interface CachedRow {
  keyword: string;
  metro: string;
  geo_target_id: string | null;
  avg_monthly_searches: number | string | null;
  fetched_at: string;
}

function fromCache(row: CachedRow): KeywordVolume {
  return {
    keyword: row.keyword,
    metro: row.metro,
    volume: Number(row.avg_monthly_searches ?? 0) || 0,
    geoTargetId: row.geo_target_id ?? null,
    fetchedAt: row.fetched_at,
    cached: true,
  };
}

/**
 * Resolve a city to its geo-target, then read the seed keyword's monthly
 * volume for that geo. Returns null when the city can't be resolved (no usable
 * number to cache). Requires Google Ads credentials — callers guard with
 * isConfigured() first.
 */
async function fetchFromAds(
  keyword: string,
  city: string,
  state: string,
): Promise<{ volume: number; geoTargetId: string } | null> {
  const customer = getCustomer();
  const safeCity = sanitizeGaqlLiteral(city);
  if (!safeCity) return null;

  // 1. City name → geo-target constant, disambiguated by state on canonical_name.
  const geoRows = (await customer.query(`
    SELECT
      geo_target_constant.id,
      geo_target_constant.name,
      geo_target_constant.canonical_name,
      geo_target_constant.target_type,
      geo_target_constant.country_code
    FROM geo_target_constant
    WHERE geo_target_constant.name = '${safeCity}'
      AND geo_target_constant.country_code = 'US'
      AND geo_target_constant.target_type = 'City'
  `)) as unknown as GeoTargetLike[];

  const match = pickGeoTarget(geoRows, state);
  const geoId = match?.geo_target_constant?.id;
  if (geoId == null) return null;
  const geoTargetId = String(geoId);

  // 2. Keyword ideas, geo-targeted + English; read the seed's monthly volume.
  //    The library's request type is the full protobuf message (every field
  //    required), but at runtime it accepts this partial plain object — cast to
  //    the method's actual parameter type rather than fill in unused fields.
  type IdeasRequest = Parameters<typeof customer.keywordPlanIdeas.generateKeywordIdeas>[0];
  const ideas = (await customer.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: configuredCustomerId(),
    language: "languageConstants/1000", // English
    geo_target_constants: [`geoTargetConstants/${geoTargetId}`],
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    keyword_seed: { keywords: [keyword] },
  } as IdeasRequest)) as unknown as KeywordIdeaLike[];

  return { volume: pickVolume(ideas, keyword), geoTargetId };
}

export async function getKeywordVolume(
  keywordRaw: string,
  city: string,
  state: string,
): Promise<KeywordVolume | null> {
  const keyword = normalizeKeyword(keywordRaw);
  const metro = metroLabel(city, state);
  if (!keyword || !metro) return null;

  const sb = supabaseAdmin();

  // 1. Cache lookup. A fresh row short-circuits the API entirely.
  const { data: cachedRow } = await sb
    .from("keyword_search_volume")
    .select("keyword, metro, geo_target_id, avg_monthly_searches, fetched_at")
    .eq("keyword", keyword)
    .eq("metro", metro)
    .maybeSingle<CachedRow>();

  if (cachedRow && !isStale(cachedRow.fetched_at, new Date(), CACHE_MAX_AGE_DAYS)) {
    return fromCache(cachedRow);
  }

  // 2. Miss or stale. Without credentials we can't refresh — serve a stale row
  //    if we have one (a slightly old number still beats no number), else null.
  if (!isConfigured()) {
    return cachedRow ? fromCache(cachedRow) : null;
  }

  const live = await fetchFromAds(keyword, city, state);
  if (!live) {
    // City unresolved / no idea rows. Fall back to any stale cache we hold.
    return cachedRow ? fromCache(cachedRow) : null;
  }

  const fetchedAt = new Date().toISOString();
  const { error } = await sb.from("keyword_search_volume").upsert(
    {
      keyword,
      metro,
      geo_target_id: live.geoTargetId,
      avg_monthly_searches: live.volume,
      fetched_at: fetchedAt,
    },
    { onConflict: "keyword,metro" },
  );
  // A cache-write failure shouldn't fail the read — log and return the live
  // number anyway (next call just re-fetches).
  if (error) console.error("[keywordVolume] cache upsert failed:", error.message);

  return {
    keyword,
    metro,
    volume: live.volume,
    geoTargetId: live.geoTargetId,
    fetchedAt,
    cached: false,
  };
}
