import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export async function GET() {
  // Debug endpoint - temporarily bypass auth
  const supabase = await supabaseServer();
  const orgId = "38a6ef02-f4dc-43c8-b5ce-bebbb8ff4728"; // Use the actual org_id from dashboard logs

  // First, let's check what org_ids exist
  const { data: orgs } = await supabase
    .from("invoices")
    .select("org_id")
    .limit(5);

  // Check invoice records first to get the right org_id
  const { data: invoicesSample, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, org_id, invoice_number")
    .limit(5);

  // Check the invoice_payment_summary table structure
  const { data: paymentSummary, error: summaryError } = await supabase
    .from("invoice_payment_summary")
    .select("*")
    .limit(10);

  // Try to find a payment split/breakdown table 
  // Check if there's a table that tracks payment dates and amounts by month
  const tables = ['payment_breakdown', 'monthly_payments', 'payment_splits', 'revenue_by_month'];
  const tableResults: Record<string, any> = {};
  
  for (const tableName of tables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .limit(5);
      tableResults[tableName] = { data, error: error?.message };
    } catch (e) {
      tableResults[tableName] = { error: 'Table does not exist' };
    }
  }

  // Also check what tables exist and get some sample invoice_payment records with their direct invoice lookups
  const { data: directInvoiceCheck } = await supabase
    .from("invoices")  
    .select("*")
    .limit(3);

  const { data: paymentInvoiceCheck } = await supabase
    .from("invoice_payments")
    .select("invoice_id")
    .limit(3);

  // Check what invoices these payments point to
  const invoiceIds = paymentInvoiceCheck?.map(p => p.invoice_id) || [];
  const { data: linkedInvoices } = await supabase
    .from("invoices")
    .select("id, org_id, invoice_number, status")
    .in("id", invoiceIds);

  // Get actual org_id from first invoice if available
  const realOrgId = invoicesSample?.[0]?.org_id || orgId;

  // Get all payments without org filter first
  const { data: allPayments } = await supabase
    .from("invoice_payments")
    .select(`
      id,
      amount_cents,
      paid_at,
      payment_method,
      invoice_id,
      invoices(
        id,
        invoice_number,
        org_id,
        clients(name, email)
      )
    `)
    .order("paid_at", { ascending: false })
    .limit(20);

  // NEW dashboard query with direct invoice IDs approach
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const knownInvoiceIds = [
    "1a7d1c82-89e5-42dd-b559-21e75e532f40", // The Rapid Rescore
    "724722c2-fd22-44d3-be97-b35a5b6d328b", // Custom Website
    "7bf06f1b-7ca5-4f6c-93e0-6be5798506c0", // Website Updates
    "8af7a0b8-bd10-40cc-8352-36c33cc805ea", // Payments Backfill
    "af03574c-2c96-49f2-acca-80d1fde9500a", // Artisan Construction
    "d2bdce7b-708e-4ff5-9739-6dbc9b1fecad", // Backfill payments (fixed amount)
    "d5adf9aa-88d3-455a-8e7b-e7d7218c92e9"  // Nooqbook updates
  ];

  const { data: dashboardQuery } = await supabase
    .from("invoice_payments")
    .select("amount_cents, paid_at, invoice_id")
    .in("invoice_id", knownInvoiceIds)
    .gte("paid_at", start.toISOString());

  const { data: allPaymentsForYear } = await supabase
    .from("invoice_payments")
    .select("amount_cents, paid_at, invoice_id")
    .in("invoice_id", knownInvoiceIds);

  // Get all payments with detailed info
  const { data: payments } = await supabase
    .from("invoice_payments")
    .select(`
      id,
      amount_cents,
      paid_at,
      payment_method,
      invoices!inner(
        id,
        invoice_number,
        org_id,
        clients!inner(name, email)
      )
    `)
    .eq("invoices.org_id", realOrgId)
    .order("paid_at", { ascending: false });

  // Current month calculation
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM format
  
  // Start of this month (UTC)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  
  console.log("Debug info:", {
    currentDate: now.toISOString(),
    thisMonth,
    startOfMonth: startOfMonth.toISOString(),
    totalPayments: payments?.length || 0
  });

  // Analyze payments
  const paymentAnalysis = payments?.map(p => {
    const paidDate = new Date(p.paid_at);
    const paidMonth = p.paid_at.slice(0, 7);
    return {
      id: p.id,
      amount_cents: p.amount_cents,
      amount_usd: (p.amount_cents / 100).toFixed(2),
      paid_at: p.paid_at,
      paid_date: paidDate.toLocaleDateString(),
      paid_month: paidMonth,
      is_this_month: paidMonth === thisMonth,
      is_after_start: paidDate >= startOfMonth,
      client_name: (p.invoices as any)?.clients?.name,
      invoice_number: (p.invoices as any)?.invoice_number
    };
  }) || [];

  // Calculate totals
  const thisMonthPayments = paymentAnalysis.filter(p => p.is_this_month);
  const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + p.amount_cents, 0);
  
  const afterStartPayments = paymentAnalysis.filter(p => p.is_after_start);
  const afterStartTotal = afterStartPayments.reduce((sum, p) => sum + p.amount_cents, 0);

  // Group by month
  const byMonth: Record<string, { count: number, total: number, payments: any[] }> = {};
  paymentAnalysis.forEach(p => {
    if (!byMonth[p.paid_month]) {
      byMonth[p.paid_month] = { count: 0, total: 0, payments: [] };
    }
    byMonth[p.paid_month].count++;
    byMonth[p.paid_month].total += p.amount_cents;
    byMonth[p.paid_month].payments.push(p);
  });

  return NextResponse.json({
    debug: {
      currentDate: now.toISOString(),
      thisMonth,
      startOfMonth: startOfMonth.toISOString(),
      hardcodedOrgId: orgId,
      realOrgId,
      availableOrgs: orgs,
      invoicesSample,
      invoiceError: invoiceError?.message,
      directInvoiceCheck,
      paymentInvoiceCheck,
      linkedInvoices,
      totalPaymentsInSystem: allPayments?.length || 0,
      paymentSummaryCount: paymentSummary?.length || 0,
      paymentSummaryError: summaryError?.message,
      tableSearchResults: tableResults,
      dashboardQueryResults: dashboardQuery?.length || 0,
      allPaymentsForYearCount: allPaymentsForYear?.length || 0,
      dashboardStart: start.toISOString()
    },
    rawData: {
      allPayments,
      filteredPayments: payments,
      dashboardQuery,
      paymentSummary,
      allPaymentsForYear
    },
    totals: {
      thisMonthByString: {
        total_cents: thisMonthTotal,
        total_usd: (thisMonthTotal / 100).toFixed(2),
        count: thisMonthPayments.length
      },
      thisMonthByDate: {
        total_cents: afterStartTotal,
        total_usd: (afterStartTotal / 100).toFixed(2),
        count: afterStartPayments.length
      }
    },
    byMonth,
    allPayments: paymentAnalysis
  });
}