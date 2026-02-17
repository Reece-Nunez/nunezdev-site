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

// GET /api/proposals/[id] - Get single proposal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select(`
      *,
      clients (id, name, email, company, phone)
    `)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  return NextResponse.json({ proposal });
}

// PATCH /api/proposals/[id] - Update proposal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  try {
    const body = await request.json();

    // Verify proposal belongs to org
    const { data: existing, error: fetchError } = await supabase
      .from("proposals")
      .select("id, status")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // Don't allow editing accepted/rejected proposals
    if (['accepted', 'rejected'].includes(existing.status)) {
      return NextResponse.json({ error: "Cannot edit a proposal that has been accepted or rejected" }, { status: 400 });
    }

    // If line_items changed, recalculate totals
    const updateData: Record<string, unknown> = { ...body };
    if (body.line_items) {
      const { subtotal_cents, tax_cents, discount_cents, amount_cents } = calculateTotals(
        body.line_items,
        body.discount_type,
        body.discount_value
      );
      updateData.subtotal_cents = subtotal_cents;
      updateData.tax_cents = tax_cents;
      updateData.discount_cents = discount_cents;
      updateData.amount_cents = amount_cents;
    }

    const { data: proposal, error: updateError } = await supabase
      .from("proposals")
      .update(updateData)
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating proposal:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ proposal });
  } catch (error) {
    console.error("Error in PATCH /api/proposals/[id]:", error);
    return NextResponse.json({ error: "Failed to update proposal" }, { status: 500 });
  }
}

// DELETE /api/proposals/[id] - Delete proposal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  const { error } = await supabase
    .from("proposals")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error("Error deleting proposal:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
