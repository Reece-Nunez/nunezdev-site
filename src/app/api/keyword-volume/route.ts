import { NextRequest, NextResponse } from "next/server";
import { getKeywordVolume } from "@/lib/keywordVolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal keyword search-volume lookup for the leadgen outreach pipeline.
 *
 * GET /api/keyword-volume?keyword=plumber&city=Tulsa&state=Oklahoma
 *   → { keyword, metro, volume, geoTargetId, fetchedAt, cached }
 *
 * `volume` is the average monthly searches for the trade near the metro; the
 * pipeline uses it for the "N people a month searched for a {trade}" outreach
 * line. Reads through the keyword_search_volume cache (Google API only on a
 * cache miss/stale row).
 *
 * Auth: shared bearer secret (KEYWORD_VOLUME_SECRET), same pattern as the cron
 * routes. This is server-to-server only — never called from a browser.
 *
 * Responses:
 *   200 { volume: number, ... }   — resolved (may be 0 when Google has no data)
 *   200 { volume: null, reason }  — city unresolved / Ads not configured; the
 *                                   caller should just omit the demand line
 *   400 — missing keyword or city
 *   401 — bad/absent secret
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.KEYWORD_VOLUME_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get("keyword") || "").trim();
  const city = (searchParams.get("city") || "").trim();
  const state = (searchParams.get("state") || "").trim();

  if (!keyword || !city) {
    return NextResponse.json(
      { error: "keyword and city are required" },
      { status: 400 },
    );
  }

  try {
    const result = await getKeywordVolume(keyword, city, state);
    if (!result) {
      return NextResponse.json({
        volume: null,
        reason: "no data (city unresolved or Google Ads not configured)",
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api] keyword-volume failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
