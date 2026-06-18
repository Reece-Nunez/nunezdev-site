import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { processRecurringInvoices } from "@/lib/recurringInvoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // --- Auth: cron secret (server-to-server) OR an authenticated user session
  // (the manual "process now" button in the dashboard). ---
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;

  let isAuthorized = isCronRequest;
  if (!isCronRequest) {
    try {
      const supabase = await supabaseServer();
      const { data: { user } } = await supabase.auth.getUser();
      isAuthorized = !!user;
    } catch {
      isAuthorized = false;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status, body } = await processRecurringInvoices();
  return NextResponse.json(body, { status });
}
