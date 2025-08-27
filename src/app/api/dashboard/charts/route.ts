import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// Returns: { pipelineByStage: {stage:string, value_cents:number}[], revenueByMonth: {month:string, cents:number}[] }
export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  // Pipeline by stage (open only)
  const { data: deals } = await supabase
    .from("deals")
    .select("stage, value_cents")
    .eq("org_id", orgId);

  const stages = ['Contacted','Negotiation','Contract Sent','Contract Signed'];
  const pipelineMap: Record<string, number> = { 'Contacted':0, 'Negotiation':0, 'Contract Sent':0, 'Contract Signed':0 };
  (deals ?? []).forEach(d => {
    if (stages.includes(d.stage as string)) pipelineMap[d.stage as string] += d.value_cents ?? 0;
  });
  const pipelineByStage = stages.map(s => ({ stage: s, value_cents: pipelineMap[s] }));

  // Revenue by month (YTD, from actual payments)
  const start = new Date();
  start.setMonth(0); start.setDate(1); start.setHours(0,0,0,0);
  
  const { data: payments } = await supabase
    .from("invoice_payments")
    .select(`
      amount_cents,
      paid_at,
      invoices!inner(org_id)
    `)
    .eq("invoices.org_id", orgId)
    .gte("paid_at", start.toISOString());

  const revMap: Record<string, number> = {};
  (payments ?? []).forEach(payment => {
    const m = new Date(payment.paid_at).toISOString().slice(0,7); // YYYY-MM
    revMap[m] = (revMap[m] ?? 0) + (payment.amount_cents ?? 0);
  });
  const months = Array.from({length: 12}, (_,k) => {
    const d = new Date(start.getFullYear(), k, 1);
    return d.toISOString().slice(0,7);
  });
  const revenueByMonth = months.map(m => ({ month: m, cents: revMap[m] ?? 0 }));

  return NextResponse.json({ pipelineByStage, revenueByMonth });
}
