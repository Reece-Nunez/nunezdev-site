import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { AgreementSection } from "@/types/agreements";

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

/** Keep only well-formed { heading, body } blocks. */
function sanitizeSections(input: unknown): AgreementSection[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => ({
      heading: typeof s?.heading === "string" ? s.heading : "",
      body: typeof s?.body === "string" ? s.body : "",
    }))
    .filter((s) => s.heading.trim() !== "" || s.body.trim() !== "");
}

// GET /api/agreements - List all agreements for the org
export async function GET() {
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  const { data: agreements, error } = await supabase
    .from("agreements")
    .select(`
      *,
      clients (id, name, email, company, phone, sms_opted_out_at)
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching agreements:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agreements: agreements ?? [] });
}

// POST /api/agreements - Create a new agreement
export async function POST(request: NextRequest) {
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  try {
    const body = await request.json();
    const {
      client_id,
      title,
      summary,
      sections,
      valid_until,
      require_signature = true,
      internal_notes,
    } = body;

    if (!client_id) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // Verify client belongs to org
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, email")
      .eq("id", client_id)
      .eq("org_id", orgId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: numData } = await supabase.rpc("generate_agreement_number", { p_org_id: orgId });
    const agreement_number = numData || `AGR-${Date.now()}`;

    const { data: agreement, error: insertError } = await supabase
      .from("agreements")
      .insert({
        org_id: orgId,
        client_id,
        agreement_number,
        title,
        summary: summary ?? null,
        sections: sanitizeSections(sections),
        valid_until: valid_until || null,
        require_signature,
        internal_notes: internal_notes ?? null,
        status: "draft",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating agreement:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ agreement }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/agreements:", error);
    return NextResponse.json({ error: "Failed to create agreement" }, { status: 500 });
  }
}
