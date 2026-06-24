import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { runAllAutomation } from "@/lib/report-automation";
import { discoverIntegrations } from "@/lib/integrations/discover";

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
    .select("id, name, website_url, ga4_property_id, vercel_project_id, gsc_site_url")
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

  // Auto-resolve any missing integration IDs from the website URL so the user
  // never has to look them up by hand. Discovered values are persisted back to
  // the client so later runs are instant, and never overwrite a value already
  // set manually.
  let ga4PropertyId = client.ga4_property_id;
  let vercelProjectId = client.vercel_project_id;
  let gscSiteUrl = client.gsc_site_url;
  if (!ga4PropertyId || !vercelProjectId || !gscSiteUrl) {
    try {
      const discovered = await discoverIntegrations(client.website_url);
      const persist: Record<string, string> = {};
      if (!ga4PropertyId && discovered.ga4.value) {
        ga4PropertyId = discovered.ga4.value;
        persist.ga4_property_id = discovered.ga4.value;
      }
      if (!vercelProjectId && discovered.vercel.value) {
        vercelProjectId = discovered.vercel.value;
        persist.vercel_project_id = discovered.vercel.value;
      }
      if (!gscSiteUrl && discovered.gsc.value) {
        gscSiteUrl = discovered.gsc.value;
        persist.gsc_site_url = discovered.gsc.value;
      }
      if (Object.keys(persist).length > 0) {
        await supabase.from("clients").update(persist).eq("id", client_id).eq("org_id", orgId);
      }
    } catch (e: any) {
      console.error("[automate] Integration auto-detect failed:", e.message);
    }
  }

  console.log("[automate] Client automation fields:", {
    website_url: client.website_url,
    ga4_property_id: ga4PropertyId,
    vercel_project_id: vercelProjectId,
    gsc_site_url: gscSiteUrl,
  });

  try {
    const result = await runAllAutomation({
      websiteUrl: client.website_url,
      ga4PropertyId,
      vercelProjectId,
      gscSiteUrl,
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
