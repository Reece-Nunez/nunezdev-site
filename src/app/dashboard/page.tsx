import Cards from "@/components/dashboard/Cards";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { requireOwner } from "@/lib/authz";
import { getAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

async function getKpisData() {
  const guard = await requireOwner();
  if (!guard.ok) return null;
  const orgId = guard.orgId!;

  try {
    const analytics = await getAnalytics(orgId);

    // Add legacy KPI calculations for the secondary metrics
    // These are for the metrics that aren't part of the main clickable analytics
    const avgDealValue = analytics.openDeals.length > 0
      ? analytics.openDeals.reduce((sum, d) => sum + d.amount, 0) / analytics.openDeals.length
      : 0;

    const dealsClosedThisMonth = 0; // TODO: Add this to analytics service
    const totalWonValue = 0; // TODO: Add this to analytics service
    const avgPaymentTime = 30; // TODO: Add this to analytics service
    const recentPaymentCount = analytics.thisMonthPayments.length;
    const totalDeals = analytics.openDeals.length; // This is just open deals for now
    const wonDeals = 0; // TODO: Add this to analytics service
    const overdueInvoices = analytics.outstandingInvoices.filter(inv => inv.status === 'overdue').length;

    return {
      ...analytics,
      // Legacy props for secondary metrics
      openDealsCount: analytics.openDeals.length,
      avgDealValue,
      dealsClosedThisMonth,
      totalWonValue,
      avgPaymentTime,
      recentPaymentCount,
      totalDeals,
      wonDeals,
      overdueInvoices
    };
  } catch (error) {
    console.error('Failed to load analytics:', error);
    return null;
  }
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
