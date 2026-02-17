import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import { requireOwner } from "@/lib/authz";
import DashboardClient from "./dashboard-client";
import MobileNavigation from "@/components/dashboard/MobileNavigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const guard = await requireOwner();
  if (!guard.ok) {
    if (guard.reason === "unauthenticated") redirect("/login?next=/dashboard");
    redirect("/");
  }

  return (
    <DashboardClient>
      <div className="min-h-screen bg-gray-100">
        {/* Mobile Navigation */}
        <MobileNavigation />
        
        {/* Desktop Layout */}
        <div className="flex">
          {/* Desktop Sidebar - hidden on mobile */}
          <div className="hidden lg:block">
            <Sidebar />
          </div>
          
          {/* Main Content */}
          <main className="flex-1 pt-32 lg:pt-6 max-w-full overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </DashboardClient>
  );
}
