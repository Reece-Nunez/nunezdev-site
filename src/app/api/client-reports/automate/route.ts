import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { runAllAutomation } from "@/lib/report-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function POST(req: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });
  const { supabase, orgId } = gate;

  const { client_id, report_month } = await req.json();

  if (!client_id || !report_month) {
    return NextResponse.json(
      { error: "Missing required fields: client_id, report_month" },
      { status: 400 },
    );
  }

  // Fetch client with automation fields
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, website_url, ga4_property_id, vercel_project_id")
    .eq("id", client_id)
    .eq("org_id", orgId)
    .single();

  if (error || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.website_url) {
    return NextResponse.json(
      { error: "Client has no website URL configured. Add one in client settings." },
      { status: 400 },
    );
  }

  try {
    const result = await runAllAutomation({
      websiteUrl: client.website_url,
      ga4PropertyId: client.ga4_property_id,
      vercelProjectId: client.vercel_project_id,
      reportMonth: report_month,
      orgId,
      supabase,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("Report automation error:", e);
    return NextResponse.json(
      { error: `Automation failed: ${e.message}` },
      { status: 500 },
    );
  }
}
