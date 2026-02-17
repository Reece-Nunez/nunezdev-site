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
    .from("notes")
    .select("*")
    .eq("org_id", orgId)
    .eq("relates_to", "client")
    .eq("relates_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // ✅
  const { body } = await req.json();
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data, error } = await supabase
    .from("notes")
    .insert({ org_id: orgId, relates_to: "client", relates_id: id, body, created_by: user.id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ note: data });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id: clientId } = await ctx.params;
  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "Missing note id" }, { status: 400 });

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = m?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  // Constrain delete to same org + this client
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("relates_to", "client")
    .eq("relates_id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}