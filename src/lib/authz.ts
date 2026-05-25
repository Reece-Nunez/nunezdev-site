import { supabaseServer } from "@/lib/supabaseServer";

// TODO(auth-drift): many routes under /api/clients/*, /api/invoices/*, /api/proposals/*,
// /api/time-entries/*, /api/google/*, /api/tax-documents/*, /api/payments/*,
// /api/client-reports/*, /api/recurring-invoices/* re-implement getUser + org_members
// inline INSTEAD of calling requireOwner(). They accept ANY org_member row, not just
// role='owner'. Harmless while you are the only user. The first time you add a non-owner
// teammate, migrate those routes to requireOwner() before granting them access.
export async function requireOwner() {
  const supabase = await supabaseServer();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false, reason: "unauthenticated" as const };

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
