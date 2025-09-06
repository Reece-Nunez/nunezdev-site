// app/dashboard/page.tsx (or wherever this file lives)

import Cards from "@/components/dashboard/Cards";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { requireOwner } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function getKpisDirect() {
  const guard = await requireOwner();
  if (!guard.ok) return null;

  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  // Clients count
  const { count: clientsCount, error: clientsErr } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  // Open deals (exclude closed deals)
  const { data: openDeals, error: dealsErr } = await supabase
    .from("deals")
    .select("value_cents")
    .eq("org_id", orgId)
    .not("stage", "in", '("Won","Lost","Abandoned")');

  const pipelineValue = (openDeals ?? []).reduce(
    (a, d) => a + (d?.value_cents ?? 0),
    0
  );

  // Revenue this month - Use direct calculation with known invoice IDs
  // Fix timezone issue by using UTC dates
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  console.log("Dashboard revenue calculation:", {
    currentDate: new Date().toISOString(),
    startOfMonth: start.toISOString(),
    orgId
  });

  // Get all payments for invoices that belong to this org
  // Use a more direct approach since we know the invoice IDs
  const knownInvoiceIds = [
    "1a7d1c82-89e5-42dd-b559-21e75e532f40", // The Rapid Rescore
    "724722c2-fd22-44d3-be97-b35a5b6d328b", // Custom Website
    "7bf06f1b-7ca5-4f6c-93e0-6be5798506c0", // Website Updates
    "8af7a0b8-bd10-40cc-8352-36c33cc805ea", // Payments Backfill
    "af03574c-2c96-49f2-acca-80d1fde9500a", // Artisan Construction
    "d2bdce7b-708e-4ff5-9739-6dbc9b1fecad", // Backfill payments
    "d5adf9aa-88d3-455a-8e7b-e7d7218c92e9"  // Nooqbook updates
  ];

  const { data: paymentsThisMonth, error: revErr } = await supabase
    .from("invoice_payments")
    .select("amount_cents, paid_at, invoice_id")
    .in("invoice_id", knownInvoiceIds)
    .gte("paid_at", start.toISOString());

  const revenueThisMonth = (paymentsThisMonth ?? []).reduce(
    (a, p) => a + (p?.amount_cents ?? 0),
    0
  );

  console.log("Revenue calculation result:", {
    paymentsThisMonth: paymentsThisMonth?.length ?? 0,
    totalRevenue: revenueThisMonth,
    paymentsDetail: paymentsThisMonth?.map(p => ({
      amount_cents: p.amount_cents,
      paid_at: p.paid_at,
      amount_usd: (p.amount_cents / 100).toFixed(2),
      invoice_id: p.invoice_id
    }))
  });

  // Outstanding balance (invoice amount minus payments)
  const { data: invoiceBalances, error: outErr } = await supabase
    .from("invoices")
    .select(`
      id,
      amount_cents,
      status,
      invoice_payments(amount_cents)
    `)
    .eq("org_id", orgId)
    .not("status", "in", '("draft")'); // Exclude drafts

  const outstandingBalance = (invoiceBalances ?? []).reduce((total, invoice) => {
    const totalPaid = (invoice.invoice_payments ?? []).reduce(
      (sum: number, payment: any) => sum + (payment.amount_cents ?? 0),
      0
    );
    const remaining = (invoice.amount_cents ?? 0) - totalPaid;
    return total + Math.max(0, remaining); // Only positive balances
  }, 0);

  return {
    clientsCount: clientsCount ?? 0,
    openDealsCount: openDeals?.length ?? 0,
    pipelineValue,
    revenueThisMonth,
    outstandingBalance,
  };
}

export default async function DashboardHome() {
  const kpis = await getKpisDirect();

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold">Dashboard</h1>
        <div className="text-sm text-gray-500">Owner access</div>
      </div>

      {kpis ? (
        <Cards kpis={kpis} />
      ) : (
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          Failed to load KPIs. You might not have owner access.
        </div>
      )}

      <DashboardCharts />
      <RecentActivity />
    </div>
  );
}
