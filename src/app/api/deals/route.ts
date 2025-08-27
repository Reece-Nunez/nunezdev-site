import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  // Fetch deals with client information
  const { data, error } = await supabase
    .from("deals")
    .select(`
      id,
      title,
      stage,
      value_cents,
      probability,
      expected_close_date,
      created_at,
      source,
      hubspot_deal_id,
      client:client_id(
        id,
        name,
        email
      )
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ deals: data || [] });
}