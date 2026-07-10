import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { calculateDocumentTotals } from "@/lib/documentTotals";

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

// GET /api/proposals - List all proposals
export async function GET() {
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  const { data: proposals, error } = await supabase
    .from("proposals")
    .select(`
      *,
      clients (id, name, email, company, phone, sms_opted_out_at)
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching proposals:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proposals: proposals ?? [] });
}

// POST /api/proposals - Create new proposal
export async function POST(request: NextRequest) {
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  try {
    const body = await request.json();
    const {
      client_id,
      title,
      description,
      line_items = [],
      discount_type,
      discount_value,
      valid_until,
      project_overview,
      project_start_date,
      estimated_delivery_date,
      technology_stack,
      terms_conditions,
      payment_terms,
      payment_schedule,
      require_signature = true,
      internal_notes,
      // Raw AI draft captured by the form at generate time; null when the
      // proposal wasn't AI-drafted. Stored so the AI-vs-final delta is
      // recoverable for evals (see migration add_proposal_ai_draft.sql).
      ai_draft = null,
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

    // Generate proposal number
    const { data: numData } = await supabase.rpc('generate_proposal_number', { p_org_id: orgId });
    const proposal_number = numData || `PROP-${Date.now()}`;

    // Calculate totals (shared with invoices so a proposal and the invoice it
    // becomes always total identically)
    const { subtotal_cents, tax_cents, discount_cents, total_cents: amount_cents } =
      calculateDocumentTotals(line_items, discount_type, discount_value);

    // Create proposal
    const { data: proposal, error: insertError } = await supabase
      .from("proposals")
      .insert({
        org_id: orgId,
        client_id,
        proposal_number,
        title,
        description,
        line_items,
        subtotal_cents,
        discount_type,
        discount_value,
        discount_cents,
        tax_cents,
        amount_cents,
        valid_until,
        project_overview,
        project_start_date,
        estimated_delivery_date,
        technology_stack,
        terms_conditions,
        payment_terms,
        payment_schedule,
        require_signature,
        internal_notes,
        ai_draft,
        status: 'draft'
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating proposal:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/proposals:", error);
    return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });
  }
}
