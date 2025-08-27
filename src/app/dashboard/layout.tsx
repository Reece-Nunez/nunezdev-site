import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import { requireOwner } from "@/lib/authz";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const guard = await requireOwner();
  if (!guard.ok) {
    if (guard.reason === "unauthenticated") redirect("/login?next=/dashboard");
    redirect("/");
  }

  return (
    <DashboardClient>
      <div className="min-h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </DashboardClient>
  );
}
