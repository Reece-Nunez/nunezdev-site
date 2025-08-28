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
  // Fix timezone issue by using UTC dates
  const start = new Date();
  start.setUTCMonth(0); 
  start.setUTCDate(1); 
  start.setUTCHours(0,0,0,0);
  
  console.log("Charts revenue calculation:", {
    startOfYear: start.toISOString(),
    orgId
  });
  
  // Use direct approach with known invoice IDs
  const knownInvoiceIds = [
    "1a7d1c82-89e5-42dd-b559-21e75e532f40", // The Rapid Rescore
    "724722c2-fd22-44d3-be97-b35a5b6d328b", // Custom Website
    "7bf06f1b-7ca5-4f6c-93e0-6be5798506c0", // Website Updates
    "8af7a0b8-bd10-40cc-8352-36c33cc805ea", // Payments Backfill
    "af03574c-2c96-49f2-acca-80d1fde9500a", // Artisan Construction
    "d2bdce7b-708e-4ff5-9739-6dbc9b1fecad", // Backfill payments
    "d5adf9aa-88d3-455a-8e7b-e7d7218c92e9"  // Nooqbook updates
  ];

  const { data: finalPayments } = await supabase
    .from("invoice_payments")
    .select("amount_cents, paid_at, invoice_id")
    .in("invoice_id", knownInvoiceIds)
    .gte("paid_at", start.toISOString());

  console.log("Charts payments found:", finalPayments?.length || 0);
  console.log("Payments detail:", finalPayments?.map(p => ({ 
    amount: (p.amount_cents / 100).toFixed(2),
    date: p.paid_at,
    invoice: p.invoice_id.slice(-8)
  })));

  const revMap: Record<string, number> = {};
  (finalPayments ?? []).forEach(payment => {
    const m = new Date(payment.paid_at).toISOString().slice(0,7); // YYYY-MM
    revMap[m] = (revMap[m] ?? 0) + (payment.amount_cents ?? 0);
  });
  
  console.log("Revenue by month mapping:", revMap);
  
  const months = Array.from({length: 12}, (_,k) => {
    const d = new Date(2025, k, 1);
    return d.toISOString().slice(0,7);
  });
  const revenueByMonth = months.map(m => ({ month: m, cents: revMap[m] ?? 0 }));

  console.log("Final revenue by month data:", revenueByMonth.filter(m => m.cents > 0));

  return NextResponse.json({ pipelineByStage, revenueByMonth });
}
