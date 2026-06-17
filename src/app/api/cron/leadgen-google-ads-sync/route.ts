import { NextRequest, NextResponse } from "next/server";
import { syncGoogleAds } from "@/lib/googleAdsSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily Google Ads metrics sync.
 *
 * Pulls the trailing 30 days of campaign + keyword metrics from the Google Ads
 * API and upserts them into the snapshot tables. A 30-day window (not just
 * "yesterday") means each run also corrects the prior days' numbers, which
 * Google keeps revising as conversions attribute late.
 *
 * Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` (same pattern
 * as cron/leadgen-reply-sync). No-ops cleanly when credentials are absent so a
 * pre-setup deploy doesn't error every night.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncGoogleAds(30);
    if (!result.configured) {
      return NextResponse.json({ skipped: "GOOGLE_ADS_* env vars not configured" });
    }
    console.log("[cron] leadgen-google-ads-sync:", result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron] leadgen-google-ads-sync failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
