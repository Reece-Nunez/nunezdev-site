import Cards from "@/components/dashboard/Cards";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { requireOwner } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function getKpisData() {
  const guard = await requireOwner();
  if (!guard.ok) return null;
  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  const { count: clientsCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const { data: openDeals } = await supabase
    .from("deals")
    .select("value_cents")
    .eq("org_id", orgId)
    .not("stage", "in", '("Won","Lost","Abandoned")');

  const pipelineValue = (openDeals ?? []).reduce((a, d) => a + (d.value_cents ?? 0), 0);

  const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
  const { data: paymentsThisMonth } = await supabase
    .from("invoice_payments")
    .select("amount_cents, invoices!inner(org_id)")
    .eq("invoices.org_id", orgId)
    .gte("paid_at", start.toISOString());

  const revenueThisMonth = (paymentsThisMonth ?? []).reduce((a, r) => a + (r.amount_cents ?? 0), 0);

  const { data: outstandingInvoices } = await supabase
    .from("invoices")
    .select(`
      amount_cents,
      invoice_payments(amount_cents)
    `)
    .eq("org_id", orgId)
    .in("status", ["sent","overdue"]);

  const outstandingBalance = (outstandingInvoices ?? []).reduce((a, invoice) => {
    const totalPaid = (invoice.invoice_payments ?? []).reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);
    const remaining = Math.max(0, (invoice.amount_cents ?? 0) - totalPaid);
    return a + remaining;
  }, 0);

  // Additional KPIs for comprehensive dashboard
  const { data: allDeals } = await supabase
    .from("deals")
    .select("stage, value_cents, created_at")
    .eq("org_id", orgId);

  const wonDeals = (allDeals ?? []).filter(d => d.stage === 'Won');
  const totalWonValue = wonDeals.reduce((sum, d) => sum + (d.value_cents ?? 0), 0);
  const conversionRate = allDeals?.length ? Math.round((wonDeals.length / allDeals.length) * 100) : 0;
  const avgDealValue = allDeals?.length ? Math.round(allDeals.reduce((sum, d) => sum + (d.value_cents ?? 0), 0) / allDeals.length) : 0;

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const dealsClosedThisMonth = wonDeals.filter(d => new Date(d.created_at) >= monthStart).length;

  const { data: allInvoices } = await supabase
    .from("invoices")
    .select("status, amount_cents, issued_at, due_at")
    .eq("org_id", orgId);

  const overdue = (allInvoices ?? []).filter(inv => 
    inv.status === 'sent' && inv.due_at && new Date(inv.due_at) < new Date()
  ).length;

  const { data: allPayments } = await supabase
    .from("invoice_payments")
    .select("amount_cents, paid_at, invoices!inner(org_id)")
    .eq("invoices.org_id", orgId);

  const totalRevenue = (allPayments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentPayments = (allPayments ?? []).filter(p => new Date(p.paid_at) >= thirtyDaysAgo);
  const recentPaymentCount = recentPayments.length;

  const paidInvoices = (allInvoices ?? []).filter(inv => inv.status === 'paid');
  const avgPaymentTime = paidInvoices.length > 0 ? 
    Math.round(paidInvoices.reduce((sum, inv) => {
      if (inv.issued_at && inv.due_at) {
        const issued = new Date(inv.issued_at);
        const paid = new Date(inv.due_at); // Approximation
        return sum + (paid.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24);
      }
      return sum;
    }, 0) / paidInvoices.length) : 0;

  return {
    clientsCount: clientsCount ?? 0,
    openDealsCount: openDeals?.length ?? 0,
    pipelineValue,
    revenueThisMonth,
    outstandingBalance,
    totalDeals: allDeals?.length ?? 0,
    wonDeals: wonDeals.length,
    totalWonValue,
    conversionRate,
    avgDealValue,
    dealsClosedThisMonth,
    overdueInvoices: overdue,
    avgPaymentTime,
    totalRevenue,
    recentPaymentCount
  };
}

export default async function DashboardHome() {
  // Check authorization first
  const guard = await requireOwner();
  if (!guard.ok) {
    return (
      <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          You do not have owner access to view this dashboard.
        </div>
      </div>
    );
  }

  const kpis = await getKpisData();

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
