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

  // Revenue this month (from invoice_payments table)
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const { data: paymentsThisMonth, error: revErr } = await supabase
    .from("invoice_payments")
    .select(`
      amount_cents,
      paid_at,
      invoices!inner(org_id)
    `)
    .eq("invoices.org_id", orgId)
    .gte("paid_at", start.toISOString());

  const revenueThisMonth = (paymentsThisMonth ?? []).reduce(
    (a, p) => a + (p?.amount_cents ?? 0),
    0
  );

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
    <div className="space-y-6 my-48">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
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
