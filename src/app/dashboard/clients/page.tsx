import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import ClientsPageWrapper from "@/components/clients/ClientsPageWrapper";
import Link from "next/link";

export const dynamic = "force-dynamic"; // don't cache; show fresh CRM data
export const runtime = "nodejs";

export default async function DashboardClientsPage() {
  const supabase = await supabaseServer();

  // Require login
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/clients");

  // Find the viewer's org
  const { data: memberships, error: mErr } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (mErr || !memberships?.length) {
    redirect("/dashboard?error=no_org");
  }

  return (
    <div className="px-3 py-4 sm:p-6 space-y-4 max-w-full min-w-0">
      <div className="flex items-center justify-between gap-3 max-w-full">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 min-w-0 truncate">Clients</h1>
        <Link
          href="/clients/new"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-white hover:opacity-90 text-sm whitespace-nowrap flex-shrink-0"
        >
          + New
        </Link>
      </div>

      <div className="max-w-full min-w-0">
        <ClientsPageWrapper />
      </div>
    </div>
  );
}
