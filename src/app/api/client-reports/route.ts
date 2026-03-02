import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuthedOrgId() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, json: { error: "Unauthorized" } };

  const { data: m, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (error) return { ok: false as const, status: 400 as const, json: { error: error.message } };
  const orgId = m?.[0]?.org_id;
  if (!orgId) return { ok: false as const, status: 403 as const, json: { error: "No org" } };

  return { ok: true as const, supabase, orgId, user };
}

/** GET: List client reports, optionally filtered by client_id */
export async function GET(req: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });
  const { supabase, orgId } = gate;

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");

  let query = supabase
    .from("client_reports")
    .select("id, org_id, client_id, report_month, sent_at, created_at, updated_at, clients(name, email, company)")
    .eq("org_id", orgId)
    .order("report_month", { ascending: false });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data || []);
}

/** POST: Create or update a client report */
export async function POST(req: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });
  const { supabase, orgId } = gate;

  const body = await req.json();
  const { client_id, report_month, report_data } = body;

  if (!client_id || !report_month || !report_data) {
    return NextResponse.json({ error: "Missing required fields: client_id, report_month, report_data" }, { status: 400 });
  }

  // Upsert: if a report for this client+month already exists, update it
  const { data, error } = await supabase
    .from("client_reports")
    .upsert(
      {
        org_id: orgId,
        client_id,
        report_month,
        report_data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,client_id,report_month" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
