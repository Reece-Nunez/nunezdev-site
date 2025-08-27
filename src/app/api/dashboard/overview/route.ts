import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  const { count: clientsCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const { data: openDeals } = await supabase
    .from("deals")
    .select("value_cents")
    .eq("org_id", orgId)
    .not("stage", "in", '("Won","Lost")');

  const pipelineValue = (openDeals ?? []).reduce((a, d) => a + (d.value_cents ?? 0), 0);

  const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
  const { data: paidThisMonth } = await supabase
    .from("invoices")
    .select("amount_cents, issued_at, status")
    .eq("org_id", orgId)
    .eq("status", "paid")
    .gte("issued_at", start.toISOString());

  const revenueThisMonth = (paidThisMonth ?? []).reduce((a, r) => a + (r.amount_cents ?? 0), 0);

  const { data: outstanding } = await supabase
    .from("invoices")
    .select("amount_cents, status")
    .eq("org_id", orgId)
    .in("status", ["sent","overdue"]);

  const outstandingBalance = (outstanding ?? []).reduce((a, r) => a + (r.amount_cents ?? 0), 0);

  return NextResponse.json({
    clientsCount: clientsCount ?? 0,
    openDealsCount: openDeals?.length ?? 0,
    pipelineValue,
    revenueThisMonth,
    outstandingBalance
  });
}
