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
    .eq("org_id", orgId)
    .not("stage", "in", '("Won","Lost","Abandoned")');

  const stages = ['Contacted','Negotiation','Contract Sent','Contract Signed'];
  const pipelineMap: Record<string, number> = {};
  stages.forEach(s => pipelineMap[s] = 0);
  
  (deals ?? []).forEach(d => {
    if (stages.includes(d.stage as string)) {
      pipelineMap[d.stage as string] += d.value_cents ?? 0;
    }
  });
  const pipelineByStage = stages.map(s => ({ stage: s, value_cents: pipelineMap[s] }));

  // Revenue by month (YTD, from actual payments) - fix to use proper org filtering
  const start = new Date();
  start.setUTCMonth(0); 
  start.setUTCDate(1); 
  start.setUTCHours(0,0,0,0);

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("amount_cents, paid_at, invoices!inner(org_id)")
    .eq("invoices.org_id", orgId)
    .gte("paid_at", start.toISOString());

  const revMap: Record<string, number> = {};
  (payments ?? []).forEach(payment => {
    const m = new Date(payment.paid_at).toISOString().slice(0,7); // YYYY-MM
    revMap[m] = (revMap[m] ?? 0) + (payment.amount_cents ?? 0);
  });
  
  const months = Array.from({length: 12}, (_,k) => {
    const d = new Date(2025, k, 1);
    return d.toISOString().slice(0,7);
  });
  const revenueByMonth = months.map(m => ({ month: m, cents: revMap[m] ?? 0 }));

  // Deal closure rates over time (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const { data: recentDeals } = await supabase
    .from("deals")
    .select("stage, created_at, value_cents")
    .eq("org_id", orgId)
    .gte("created_at", sixMonthsAgo.toISOString());

  const dealsByMonth: Record<string, {created: number, won: number, lost: number}> = {};
  const last6Months = Array.from({length: 6}, (_, k) => {
    const d = new Date();
    d.setMonth(d.getMonth() - k);
    return d.toISOString().slice(0,7);
  }).reverse();

  last6Months.forEach(m => dealsByMonth[m] = {created: 0, won: 0, lost: 0});
  
  (recentDeals ?? []).forEach(deal => {
    const m = new Date(deal.created_at).toISOString().slice(0,7);
    if (dealsByMonth[m]) {
      dealsByMonth[m].created++;
      if (deal.stage === 'Won') dealsByMonth[m].won++;
      else if (deal.stage === 'Lost') dealsByMonth[m].lost++;
    }
  });

  const closureRates = last6Months.map(m => ({
    month: m,
    created: dealsByMonth[m].created,
    won: dealsByMonth[m].won,
    lost: dealsByMonth[m].lost,
    winRate: dealsByMonth[m].created > 0 ? Math.round((dealsByMonth[m].won / dealsByMonth[m].created) * 100) : 0
  }));

  // Payment methods breakdown
  const { data: allPayments } = await supabase
    .from("invoice_payments")
    .select("payment_method, amount_cents, stripe_payment_intent_id, invoices!inner(org_id)")
    .eq("invoices.org_id", orgId);

  const methodMap: Record<string, number> = {};
  (allPayments ?? []).forEach(payment => {
    // Better payment method classification
    let method: string;
    if (payment.stripe_payment_intent_id) {
      method = 'Stripe';
    } else if (payment.payment_method === 'card') {
      method = 'Card';
    } else if (payment.payment_method === 'bank_transfer') {
      method = 'Bank Transfer';
    } else if (payment.payment_method === 'check') {
      method = 'Check';
    } else if (payment.payment_method === 'cash') {
      method = 'Cash';
    } else if (payment.payment_method) {
      method = String(payment.payment_method).charAt(0).toUpperCase() + String(payment.payment_method).slice(1);
    } else {
      method = 'Manual/Other';
    }
    
    methodMap[method] = (methodMap[method] || 0) + (payment.amount_cents || 0);
  });

  const paymentMethods = Object.entries(methodMap)
    .filter(([method, amount]) => amount > 0) // Only include methods with payments
    .map(([method, amount]) => ({
      method: method || 'Unknown',
      amount_cents: amount
    }))
    .sort((a, b) => b.amount_cents - a.amount_cents); // Sort by amount descending

  // If no payment methods found, provide fallback data
  if (paymentMethods.length === 0) {
    const totalPayments = (allPayments ?? []).reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    if (totalPayments > 0) {
      paymentMethods.push({
        method: 'Unclassified',
        amount_cents: totalPayments
      });
    }
  }

  return NextResponse.json({ 
    pipelineByStage, 
    revenueByMonth,
    closureRates,
    paymentMethods
  });
}
