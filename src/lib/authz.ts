import { supabaseServer } from "@/lib/supabaseServer";

export type OrgRole = "owner" | "member" | "viewer" | "prospector";

// TODO(auth-drift): many routes under /api/clients/*, /api/invoices/*, /api/proposals/*,
// /api/time-entries/*, /api/google/*, /api/tax-documents/*, /api/payments/*,
// /api/client-reports/*, /api/recurring-invoices/* re-implement getUser + org_members
// inline INSTEAD of calling requireOwner(). They accept ANY org_member row, not just
// role='owner'. The first non-owner teammate is now the `prospector` role (Josh), who
// would slip through those inline checks. Until they are migrated, the deny-by-default
// backstop in middleware.ts (see isPathAllowedForProspector) is what keeps a prospector
// out of them. Migrate the routes to requireOwner() if you ever add a 'member' too.
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

/**
 * Guard for any role in `allowed`. Returns the same shape as requireOwner()
 * (ok / orgId / user) so existing callers work unchanged, plus the matched role.
 */
async function requireRole(allowed: OrgRole[]) {
  const supabase = await supabaseServer();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, reason: "unauthenticated" as const };

  const { data, error: mErr } = await supabase
    .from("org_members")
    .select("org_id, role, created_at")
    .eq("user_id", user.id)
    .in("role", allowed)
    .order("created_at", { ascending: false })
    .limit(1);

  if (mErr) return { ok: false as const, reason: "forbidden" as const };

  const row = data?.[0];
  if (!row) return { ok: false as const, reason: "no-org" as const };

  return { ok: true as const, orgId: row.org_id as string, role: row.role as OrgRole, user };
}

/**
 * Owner OR prospector. Use on the leadgen / leads / thumbtack pages, server
 * actions and API routes — the only non-financial surface a prospector may use.
 */
export function requireProspecting() {
  return requireRole(["owner", "prospector"]);
}

/**
 * Owner OR prospector. Lets the restricted user load the dashboard shell;
 * per-page guards and the middleware backstop then scope what they can reach.
 */
export function requireDashboardAccess() {
  return requireRole(["owner", "prospector"]);
}
