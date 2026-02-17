import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProposalLineItem {
  description: string;
  quantity: number;
  rate_cents: number;
  amount_cents: number;
}

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

function calculateTotals(line_items: ProposalLineItem[], discount_type?: string, discount_value?: number) {
  const subtotal_cents = line_items.reduce((sum, item) => sum + item.amount_cents, 0);

  let discount_cents = 0;
  if (discount_value && discount_value > 0) {
    if (discount_type === 'percentage') {
      discount_cents = Math.round(subtotal_cents * (discount_value / 100));
    } else if (discount_type === 'fixed') {
      discount_cents = Math.round(discount_value * 100);
    }
  }

  const tax_cents = 0;
  const amount_cents = subtotal_cents + tax_cents - discount_cents;

  return { subtotal_cents, tax_cents, discount_cents, amount_cents };
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
      clients (id, name, email, company)
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
      internal_notes
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

    // Calculate totals
    const { subtotal_cents, tax_cents, discount_cents, amount_cents } = calculateTotals(
      line_items,
      discount_type,
      discount_value
    );

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
