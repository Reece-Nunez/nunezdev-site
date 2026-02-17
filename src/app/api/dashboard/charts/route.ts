import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// Returns: { revenueByMonth: {month:string, cents:number}[], paymentMethods: {method:string, amount_cents:number}[] }
export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  // Revenue by month (YTD, from actual payments)
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
    .filter(([, amount]) => amount > 0)
    .map(([method, amount]) => ({
      method: method || 'Unknown',
      amount_cents: amount
    }))
    .sort((a, b) => b.amount_cents - a.amount_cents);

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
    revenueByMonth,
    paymentMethods
  });
}
