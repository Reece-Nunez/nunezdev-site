import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await supabaseServer();

  // Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Caller org
  const { data: memberships } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id as string | undefined;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  // 1) Get the raw client by id (no org filter yet)
  const { data: rawClient, error: rawErr } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("id", id)
    .maybeSingle();

  if (rawErr) return NextResponse.json({ error: rawErr.message }, { status: 400 });
  if (!rawClient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 2) Enforce org ownership
  if (rawClient.org_id !== orgId) {
    return NextResponse.json({ error: "Forbidden (wrong org)" }, { status: 403 });
  }

  // 3) Now safely read the overview view for that id
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If the overview view somehow returns no row (shouldn't), fall back to the base client
  if (!data) {
    const { data: fallback } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();
    return NextResponse.json({ client: fallback });
  }

  return NextResponse.json({ client: data });
}
