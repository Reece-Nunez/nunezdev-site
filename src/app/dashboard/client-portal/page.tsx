import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import ClientPortalPage from "@/components/client-portal/ClientPortalPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ClientPortalRoute() {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/client-portal");

  const { data: memberships, error: mErr } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (mErr || !memberships?.length) {
    redirect("/dashboard?error=no_org");
  }

  return (
    <div className="px-3 py-4 sm:p-6 space-y-4 max-w-full min-w-0">
      <div className="max-w-full min-w-0">
        <ClientPortalPage />
      </div>
    </div>
  );
}
