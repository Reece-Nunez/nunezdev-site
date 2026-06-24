import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { discoverIntegrations } from "@/lib/integrations/discover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST: auto-detect a client's Vercel project ID and GA4 property ID from its
 * website URL. Read-only — it returns the discovered values (and a reason when
 * nothing matched); the caller decides whether to save them. Persisting is the
 * existing PATCH /api/clients/[id] flow.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, website_url")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Allow the form to pass an as-yet-unsaved URL so detection works before
  // the user clicks Save; fall back to the stored value.
  const body = await req.json().catch(() => ({}));
  const websiteUrl = (typeof body?.website_url === "string" && body.website_url.trim()) || client.website_url;
  if (!websiteUrl) {
    return NextResponse.json({ error: "Add a Website URL first, then detect integrations." }, { status: 400 });
  }

  const result = await discoverIntegrations(websiteUrl);

  return NextResponse.json({
    website_url: client.website_url,
    apex: result.apex,
    ga4_property_id: result.ga4.value,
    vercel_project_id: result.vercel.value,
    gsc_site_url: result.gsc.value,
    diagnostics: {
      ga4: result.ga4,
      vercel: result.vercel,
      gsc: result.gsc,
    },
  });
}
