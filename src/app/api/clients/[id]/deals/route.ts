import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // ✅
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data, error } = await supabase
    .from("deals")
    .select("id,title,stage,value_cents,created_at")
    .eq("org_id", orgId)
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deals: data ?? [] });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // ✅
  const { title, value_cents } = await req.json();
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data, error } = await supabase
    .from("deals")
    .insert({ org_id: orgId, client_id: id, title, value_cents: value_cents ?? 0, stage: "Contacted" })
    .select("id,title,stage,value_cents,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deal: data });
}
