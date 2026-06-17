import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { syncGoogleAds } from "@/lib/googleAdsSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual "Refresh" button on the Ads dashboard. Same sync as the nightly cron,
 * but owner-gated (session) instead of CRON_SECRET, and on-demand. Defaults to
 * a 30-day window to match the dashboard's default range.
 */
export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await syncGoogleAds(30);
    if (!result.configured) {
      return NextResponse.json(
        { error: "Google Ads isn't configured yet — set the GOOGLE_ADS_* env vars." },
        { status: 400 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dashboard] google-ads refresh failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
