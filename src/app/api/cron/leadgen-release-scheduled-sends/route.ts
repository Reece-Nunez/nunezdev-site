import { NextRequest, NextResponse } from "next/server";
import { releaseScheduledSends, isRemoteBackend } from "@/lib/leadgen-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Release deferred SMS (Phase 2 M5.1).
 *
 * Fires any SMS that was queued outside the recipient's 8am-9pm quiet hours and
 * whose 10am-local send time has now arrived. Runs hourly so a text deferred
 * overnight goes out within the hour of its scheduled slot (send_after is a
 * specific UTC instant per recipient timezone; the first hourly run past it
 * sends). No-op when nothing is due.
 *
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
    const result = await releaseScheduledSends();
    console.log("[cron] leadgen-release-scheduled-sends:", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron] leadgen-release-scheduled-sends failed:", err);
    return NextResponse.json(
      { error: "release failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
