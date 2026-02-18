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

  // Fetch one-time expenses (2025+) for profit calculations
  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount_cents, expense_date, category")
    .eq("org_id", orgId)
    .gte("expense_date", "2025-01-01");

  // Fetch recurring expenses (these have start_date in 2026+, so no overlap with
  // 2025 manual entries)
  const { data: recurringExpenses } = await supabase
    .from("recurring_expenses")
    .select("amount_cents, frequency, start_date, end_date, category, is_active")
    .eq("org_id", orgId)
    .eq("is_active", true);

  // Aggregate expenses by month and year
  const monthExpenses: Record<string, number> = {};
  const yearExpenses: Record<number, number> = {};
  const expensesByCategory: Record<string, number> = {};

  // One-time expenses
  (expenses ?? []).forEach(exp => {
    const d = new Date(exp.expense_date);
    const m = d.toISOString().slice(0, 7);
    const y = d.getUTCFullYear();
    monthExpenses[m] = (monthExpenses[m] ?? 0) + (exp.amount_cents ?? 0);
    yearExpenses[y] = (yearExpenses[y] ?? 0) + (exp.amount_cents ?? 0);
    const cat = exp.category || 'other';
    expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + (exp.amount_cents ?? 0);
  });

  // Recurring expenses — apply to each applicable month based on frequency and date range
  (recurringExpenses ?? []).forEach(rec => {
    const recStart = new Date(rec.start_date);
    const recEnd = rec.end_date ? new Date(rec.end_date) : new Date();
    const cat = rec.category || 'other';

    for (const monthStr of months) {
      const [yr, mo] = monthStr.split('-').map(Number);
      const monthStart = new Date(Date.UTC(yr, mo - 1, 1));
      const monthEnd = new Date(Date.UTC(yr, mo, 0));

      if (monthStart > recEnd || monthEnd < recStart) continue;

      let applies = false;
      if (rec.frequency === 'monthly') {
        applies = true;
      } else if (rec.frequency === 'quarterly') {
        const monthsDiff = (yr - recStart.getUTCFullYear()) * 12 + (mo - 1 - recStart.getUTCMonth());
        applies = monthsDiff >= 0 && monthsDiff % 3 === 0;
      } else if (rec.frequency === 'annually') {
        applies = (mo - 1) === recStart.getUTCMonth();
      }

      if (applies) {
        monthExpenses[monthStr] = (monthExpenses[monthStr] ?? 0) + (rec.amount_cents ?? 0);
        yearExpenses[yr] = (yearExpenses[yr] ?? 0) + (rec.amount_cents ?? 0);
        expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + (rec.amount_cents ?? 0);
      }
    }
  });

  // Add expenses to monthly data
  const revenueByMonthWithExpenses = revenueByMonth.map(m => ({
    ...m,
    expenses_cents: monthExpenses[m.month] ?? 0,
    profit_cents: m.net_cents - (monthExpenses[m.month] ?? 0),
  }));

  // Add expenses to yearly data
  const revenueByYearWithExpenses = revenueByYear.map(y => ({
    ...y,
    expenses_cents: yearExpenses[y.year] ?? 0,
    profit_cents: y.net_cents - (yearExpenses[y.year] ?? 0),
  }));

  // Top expense categories
  const topExpenseCategories = Object.entries(expensesByCategory)
    .map(([category, amount_cents]) => ({ category, amount_cents }))
    .sort((a, b) => b.amount_cents - a.amount_cents);

  return NextResponse.json({
    revenueByMonth: revenueByMonthWithExpenses,
    revenueByYear: revenueByYearWithExpenses,
    paymentMethods,
    topExpenseCategories,
  });
}
