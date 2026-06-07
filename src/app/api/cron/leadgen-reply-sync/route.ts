import { NextRequest, NextResponse } from "next/server";
import { googleServiceFactory } from "@/lib/google/googleServiceFactory";
import { listBusinesses, recordReply, isRemoteBackend } from "@/lib/leadgen-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Leadgen reply detection (Phase 2 M6, piece 1c).
 *
 * Resend webhooks give us delivery/open/bounce, and Twilio inbound gives us SMS
 * replies — but actual EMAIL replies land in the operator's Gmail inbox, which
 * neither provider sees. This cron closes that gap: for every prospect still in
 * 'contacted' (i.e. we've reached out, no reply logged yet), it searches Gmail
 * for a message from their address and, if found, records it via the pipeline's
 * /record-reply endpoint. That flips the lead to 'replied' and surfaces it in
 * the dashboard's "needs attention" banner.
 *
 * Idempotent end-to-end: the pipeline dedupes on the Gmail message id, and once
 * a lead flips to 'replied' it leaves the 'contacted' set, so we stop scanning
 * it on the next run.
 *
 * Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` (same pattern
 * as cron/process-recurring-invoices). Gmail access uses the existing
 * domain-wide-delegation service account impersonating GOOGLE_IMPERSONATION_EMAIL
 * — the gmail.readonly scope must be authorized for it in the Workspace Admin
 * console, or the client returns null and this cron no-ops gracefully.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The reply writer goes through the pipeline API; without it there's nothing
  // to write to. Skip cleanly rather than erroring the cron.
  if (!isRemoteBackend()) {
    return NextResponse.json({ skipped: "LEADGEN_API_URL not configured" });
  }

  const gmail = await googleServiceFactory.getGmailClient();
  if (!gmail) {
    return NextResponse.json({
      skipped: "Gmail client unavailable — check GOOGLE_SERVICE_ACCOUNT_KEY / "
        + "GOOGLE_IMPERSONATION_EMAIL and that gmail.readonly is delegated",
    });
  }

  // Only leads we've contacted but haven't heard back from. Once a reply flips
  // them to 'replied', they drop out of this query on the next run.
  const contacted = await listBusinesses({ status: "contacted", limit: 200 });
  const candidates = contacted.filter((b) => b.email && b.email.includes("@"));

  let scanned = 0;
  let repliesFound = 0;
  let recorded = 0;
  const errors: string[] = [];

  for (const biz of candidates) {
    scanned++;
    try {
      // newer_than bounds the search to recent mail; dedup + the status flip
      // keep this from re-recording on subsequent runs.
      const list = await gmail.users.messages.list({
        userId: "me",
        q: `from:${biz.email} newer_than:60d`,
        maxResults: 3,
      });
      const messages = list.data.messages ?? [];
      if (messages.length === 0) continue;
      repliesFound++;

      // Record the most recent matching message. Pull a snippet for the
      // engagement timeline; tolerate a metadata-fetch failure by recording
      // without one.
      const msgId = messages[0].id as string;
      let snippet: string | null = null;
      try {
        const meta = await gmail.users.messages.get({
          userId: "me",
          id: msgId,
          format: "metadata",
          metadataHeaders: ["Subject"],
        });
        snippet = (meta.data.snippet as string | undefined) ?? null;
      } catch {
        // non-fatal — record the reply without a preview snippet
      }

      const result = await recordReply(biz.id, {
        channel: "email",
        provider: "gmail",
        providerMessageId: msgId,
        snippet,
        actor: "gmail-poller",
      });
      if (result.recorded) recorded++;
    } catch (err) {
      errors.push(`${biz.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const summary = {
    scanned,
    replies_found: repliesFound,
    newly_recorded: recorded,
    errors: errors.length ? errors : undefined,
  };
  console.log("[cron] leadgen-reply-sync:", summary);
  return NextResponse.json(summary);
}
