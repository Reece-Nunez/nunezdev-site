import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  // Revenue by month (2025 through current year, from actual payments)
  const currentYear = new Date().getUTCFullYear();
  const start = new Date(Date.UTC(2025, 0, 1));

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("amount_cents, stripe_fee_cents, paid_at, invoices!inner(org_id)")
    .eq("invoices.org_id", orgId)
    .gte("paid_at", start.toISOString());

  // Aggregate by month: gross, fees
  const monthGross: Record<string, number> = {};
  const monthFees: Record<string, number> = {};
  (payments ?? []).forEach(payment => {
    const m = new Date(payment.paid_at).toISOString().slice(0, 7); // YYYY-MM
    monthGross[m] = (monthGross[m] ?? 0) + (payment.amount_cents ?? 0);
    monthFees[m] = (monthFees[m] ?? 0) + (payment.stripe_fee_cents ?? 0);
  });

  const months: string[] = [];
  for (let year = 2025; year <= currentYear; year++) {
    for (let k = 0; k < 12; k++) {
      months.push(new Date(year, k, 1).toISOString().slice(0, 7));
    }
  }

  const revenueByMonth = months.map(m => {
    const gross = monthGross[m] ?? 0;
    const fees = monthFees[m] ?? 0;
    return { month: m, cents: gross, fees_cents: fees, net_cents: gross - fees };
  });

  // Aggregate by year
  const yearGross: Record<number, number> = {};
  const yearFees: Record<number, number> = {};
  (payments ?? []).forEach(payment => {
    const y = new Date(payment.paid_at).getUTCFullYear();
    yearGross[y] = (yearGross[y] ?? 0) + (payment.amount_cents ?? 0);
    yearFees[y] = (yearFees[y] ?? 0) + (payment.stripe_fee_cents ?? 0);
  });

  const revenueByYear: { year: number; gross_cents: number; fees_cents: number; net_cents: number }[] = [];
  for (let year = 2025; year <= currentYear; year++) {
    const gross = yearGross[year] ?? 0;
    const fees = yearFees[year] ?? 0;
    revenueByYear.push({ year, gross_cents: gross, fees_cents: fees, net_cents: gross - fees });
  }

  // Payment methods breakdown
  const { data: allPayments } = await supabase
    .from("invoice_payments")
    .select("payment_method, amount_cents, stripe_payment_intent_id, invoices!inner(org_id)")
    .eq("invoices.org_id", orgId);

  const methodMap: Record<string, number> = {};
  (allPayments ?? []).forEach(payment => {
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
    revenueByYear,
    paymentMethods
  });
}
