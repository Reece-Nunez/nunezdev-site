import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgId = m?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const recurringInvoiceId = searchParams.get('recurring_invoice_id');
  const eventType = searchParams.get('event_type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  let query = supabase
    .from('recurring_invoice_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (recurringInvoiceId) {
    query = query.eq('recurring_invoice_id', recurringInvoiceId);
  }
  if (eventType) {
    query = query.eq('event_type', eventType);
  }

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ logs: logs || [] });
}
