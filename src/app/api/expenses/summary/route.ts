import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

// GET /api/expenses/summary - Get expense summaries for reporting
export async function GET(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();

  const supabase = await supabaseServer();

  // Get all expenses for the year
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("org_id", orgId)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate)
    .order("expense_date", { ascending: true });

  if (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate summaries
  const byCategory: Record<string, { count: number; total_cents: number }> = {};
  const byMonth: Record<string, { count: number; total_cents: number; tax_deductible_cents: number }> = {};
  const byVendor: Record<string, { count: number; total_cents: number }> = {};

  let totalCents = 0;
  let taxDeductibleCents = 0;
  let billableCents = 0;
  let unbilledCents = 0;

  for (const exp of expenses || []) {
    totalCents += exp.amount_cents;

    if (exp.is_tax_deductible) {
      taxDeductibleCents += exp.amount_cents;
    }

    if (exp.is_billable) {
      billableCents += exp.amount_cents;
      if (!exp.is_billed) {
        unbilledCents += exp.amount_cents;
      }
    }

    // By category
    const cat = exp.category || "other";
    if (!byCategory[cat]) {
      byCategory[cat] = { count: 0, total_cents: 0 };
    }
    byCategory[cat].count++;
    byCategory[cat].total_cents += exp.amount_cents;

    // By month
    const month = exp.expense_date.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) {
      byMonth[month] = { count: 0, total_cents: 0, tax_deductible_cents: 0 };
    }
    byMonth[month].count++;
    byMonth[month].total_cents += exp.amount_cents;
    if (exp.is_tax_deductible) {
      byMonth[month].tax_deductible_cents += exp.amount_cents;
    }

    // By vendor
    const vendor = exp.vendor || "Unknown";
    if (!byVendor[vendor]) {
      byVendor[vendor] = { count: 0, total_cents: 0 };
    }
    byVendor[vendor].count++;
    byVendor[vendor].total_cents += exp.amount_cents;
  }

  // Sort by category totals (descending)
  const categoryList = Object.entries(byCategory)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total_cents - a.total_cents);

  // Sort by month
  const monthList = Object.entries(byMonth)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Sort by vendor totals (descending), top 10
  const vendorList = Object.entries(byVendor)
    .map(([vendor, data]) => ({ vendor, ...data }))
    .sort((a, b) => b.total_cents - a.total_cents)
    .slice(0, 10);

  return NextResponse.json({
    year: parseInt(year),
    totals: {
      total_cents: totalCents,
      tax_deductible_cents: taxDeductibleCents,
      billable_cents: billableCents,
      unbilled_cents: unbilledCents,
      expense_count: expenses?.length || 0,
    },
    by_category: categoryList,
    by_month: monthList,
    top_vendors: vendorList,
  });
}
