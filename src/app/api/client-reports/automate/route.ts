import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { runAllAutomation } from "@/lib/report-automation";
import { resolveReportTier } from "@/lib/report-automation/tier";
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

  const { client_id, site_id, report_month } = await req.json();

  if (!client_id || !report_month) {
    return NextResponse.json(
      { error: "Missing required fields: client_id, report_month" },
      { status: 400 },
    );
  }

  // Resolve the integration source: a specific site (preferred) or, for legacy
  // callers without a site, the client row itself. Discovered IDs are persisted
  // back to whichever row they came from.
  const fields = "website_url, ga4_property_id, vercel_project_id, gsc_site_url, github_repo";
  let source:
    | { website_url: string | null; ga4_property_id: string | null; vercel_project_id: string | null; gsc_site_url: string | null; github_repo: string | null }
    | null = null;
  let persistTable: "client_sites" | "clients" = "clients";
  let persistId = client_id;

  if (site_id) {
    const { data: site } = await supabase
      .from("client_sites")
      .select(fields)
      .eq("id", site_id)
      .eq("client_id", client_id)
      .eq("org_id", orgId)
      .single();
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
    source = site;
    persistTable = "client_sites";
    persistId = site_id;
  } else {
    const { data: client } = await supabase
      .from("clients")
      .select(fields)
      .eq("id", client_id)
      .eq("org_id", orgId)
      .single();
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    source = client;
  }

  if (!source.website_url) {
    return NextResponse.json(
      { error: "This site has no website URL configured. Add one in the client's Sites section." },
      { status: 400 },
    );
  }

  // Auto-resolve any missing integration IDs from the website URL, persisting
  // discovered values back to the source so later runs are instant. Never
  // overwrites a value already set manually.
  let ga4PropertyId = source.ga4_property_id;
  let vercelProjectId = source.vercel_project_id;
  let gscSiteUrl = source.gsc_site_url;
  if (!ga4PropertyId || !vercelProjectId || !gscSiteUrl) {
    try {
      const discovered = await discoverIntegrations(source.website_url);
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
        await supabase.from(persistTable).update(persist).eq("id", persistId).eq("org_id", orgId);
      }
    } catch (e: any) {
      console.error("[automate] Integration auto-detect failed:", e.message);
    }
  }

  // Resolve which report tier this client qualifies for from their recurring
  // revenue. Reports start at the Essential plan ($150/mo); anything below that
  // has no monthly report, so we stop here with a clear message instead of
  // producing an empty report.
  const { tier, monthlyCents, source: tierSource } = await resolveReportTier(supabase, orgId, client_id);
  if (!tier) {
    return NextResponse.json(
      {
        error:
          "This client has no active recurring plan of $150/mo or more, so there's no monthly report tier. Set up a Care Plan subscription or recurring invoice first.",
        monthlyAmountCents: monthlyCents,
        tierSource,
      },
      { status: 400 },
    );
  }

  try {
    const result = await runAllAutomation({
      websiteUrl: source.website_url,
      ga4PropertyId,
      vercelProjectId,
      gscSiteUrl,
      githubRepo: source.github_repo,
      siteId: site_id ?? null,
      reportMonth: report_month,
      orgId,
      supabase,
      tier,
      monthlyAmountCents: monthlyCents,
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
