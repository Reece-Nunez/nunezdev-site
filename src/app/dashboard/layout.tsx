import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import { requireDashboardAccess } from "@/lib/authz";
import DashboardClient from "./dashboard-client";
import MobileNavigation from "@/components/dashboard/MobileNavigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const guard = await requireDashboardAccess();
  if (!guard.ok) {
    if (guard.reason === "unauthenticated") redirect("/login?next=/dashboard");
    redirect("/");
  }

  // The nav is filtered for the restricted `prospector` role so it only shows
  // the lead-gen surface; middleware is the actual access backstop.
  const role = guard.role;

  return (
    <DashboardClient>
      <div className="dashboard-scope min-h-screen bg-gray-100">
        <MobileNavigation role={role} />

        <div className="flex">
          <div className="hidden lg:block">
            <Sidebar role={role} />
          </div>

          {/* overflow-x-clip (not overflow-hidden) so wide tables can't cause
              horizontal scroll while still letting `position: sticky` toolbars
              inside pages work — overflow-hidden establishes a scroll container
              that breaks sticky. */}
          <main className="flex-1 pt-32 lg:pt-6 max-w-full overflow-x-clip">
            {children}
          </main>
        </div>
      </div>
    </DashboardClient>
  );
}
