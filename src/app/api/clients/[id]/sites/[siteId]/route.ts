import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; siteId: string }> };

async function gate() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, json: { error: "Unauthorized" } };
  const { data: m } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = m?.[0]?.org_id;
  if (!orgId) return { ok: false as const, status: 403 as const, json: { error: "No org" } };
  return { ok: true as const, supabase, orgId };
}

function cleanStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** PATCH: update a site. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id, siteId } = await ctx.params;
  const g = await gate();
  if (!g.ok) return NextResponse.json(g.json, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const allowed = ["label", "website_url", "ga4_property_id", "vercel_project_id", "gsc_site_url", "github_repo"];
  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in body) patch[k] = k === "label" ? (cleanStr(body[k]) || "Site") : cleanStr(body[k]);
  }

  const { data, error } = await g.supabase
    .from("client_sites")
    .update(patch)
    .eq("id", siteId)
    .eq("client_id", id)
    .eq("org_id", g.orgId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ site: data });
}

/** DELETE: remove a site. Its reports keep their history (site_id → null). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, siteId } = await ctx.params;
  const g = await gate();
  if (!g.ok) return NextResponse.json(g.json, { status: g.status });

  const { error } = await g.supabase
    .from("client_sites")
    .delete()
    .eq("id", siteId)
    .eq("client_id", id)
    .eq("org_id", g.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
