import DashboardClient from "@/components/dashboard/DashboardClient";
import { requireOwner } from "@/lib/authz";
import { getAnalytics, AnalyticsData } from "@/lib/analytics";

export const dynamic = "force-dynamic";

async function getKpisData(): Promise<AnalyticsData | null> {
  const guard = await requireOwner();
  if (!guard.ok) return null;
  const orgId = guard.orgId!;

  try {
    const analytics = await getAnalytics(orgId);
    return analytics;
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

  return <DashboardClient kpis={kpis} />;
}
