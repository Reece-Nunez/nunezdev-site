import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

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

/** GET: list a client's sites. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await gate();
  if (!g.ok) return NextResponse.json(g.json, { status: g.status });

  const { data, error } = await g.supabase
    .from("client_sites")
    .select("*")
    .eq("org_id", g.orgId)
    .eq("client_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ sites: data || [] });
}

/** POST: add a site to a client. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await gate();
  if (!g.ok) return NextResponse.json(g.json, { status: g.status });

  // Confirm the client is in this org before attaching a site to it.
  const { data: client } = await g.supabase
    .from("clients").select("id").eq("id", id).eq("org_id", g.orgId).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const insert = {
    org_id: g.orgId,
    client_id: id,
    label: cleanStr(body.label) || "New site",
    website_url: cleanStr(body.website_url),
    ga4_property_id: cleanStr(body.ga4_property_id),
    vercel_project_id: cleanStr(body.vercel_project_id),
    gsc_site_url: cleanStr(body.gsc_site_url),
  };

  const { data, error } = await g.supabase
    .from("client_sites").insert(insert).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ site: data }, { status: 201 });
}
