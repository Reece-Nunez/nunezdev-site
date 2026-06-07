import { NextRequest, NextResponse } from "next/server";
import { scanFollowUps, isRemoteBackend } from "@/lib/leadgen-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Follow-up cadence scan (Phase 2 M7).
 *
 * Runs the pipeline's /follow-ups/scan, which drafts newly-due follow-ups for
 * contacted leads that haven't replied (and cancels sequences that stopped).
 * Drafted touches land in the dashboard's "Follow-ups due" queue for 1-click
 * approval — nothing auto-sends.
 *
 * Daily cadence is enough since the schedule is day-granular (3/7/14 days).
 * Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isRemoteBackend()) {
    return NextResponse.json({ skipped: "LEADGEN_API_URL not configured" });
  }

  try {
    const result = await scanFollowUps();
    console.log("[cron] leadgen-followup-scan:", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron] leadgen-followup-scan failed:", err);
    return NextResponse.json(
      { error: "scan failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
