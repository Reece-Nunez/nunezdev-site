import { supabaseServer } from "@/lib/supabaseServer";

export async function requireOwner() {
  const supabase = await supabaseServer();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false, reason: "unauthenticated" as const };

  // Only consider OWNER memberships, prefer the latest
  const { data, error: mErr } = await supabase
    .from("org_members")
    .select("org_id, role, created_at")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .order("created_at", { ascending: false })
    .limit(1);

  if (mErr) return { ok: false, reason: "forbidden" as const };

  const row = data?.[0];
  if (!row) return { ok: false, reason: "no-org" as const };

  return { ok: true, orgId: row.org_id as string, user };
}
