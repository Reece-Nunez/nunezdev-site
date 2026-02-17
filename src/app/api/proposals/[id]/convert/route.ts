import { NextRequest, NextResponse } from "next/server";
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

// POST /api/proposals/[id]/convert - Convert accepted proposal to invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId } = auth;

  try {
    // Get proposal
    const { data: proposal, error: fetchError } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status !== 'accepted') {
      return NextResponse.json({ error: "Only accepted proposals can be converted to invoices" }, { status: 400 });
    }

    if (proposal.converted_to_invoice_id) {
      return NextResponse.json({ error: "Proposal has already been converted to an invoice", invoice_id: proposal.converted_to_invoice_id }, { status: 400 });
    }

    // Generate invoice number
    const year = new Date().getFullYear();
    const { data: lastInvoice } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("org_id", orgId)
      .like("invoice_number", `INV-${year}-%`)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastInvoice?.invoice_number) {
      const match = lastInvoice.invoice_number.match(/INV-\d{4}-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const invoice_number = `INV-${year}-${String(nextNum).padStart(4, '0')}`;

    // Calculate due date based on payment terms
    const issued_at = new Date().toISOString();
    let due_at = new Date();
    const termsDays = proposal.payment_terms ? parseInt(proposal.payment_terms) || 30 : 30;
    due_at.setDate(due_at.getDate() + termsDays);

    // Create invoice from proposal
    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        client_id: proposal.client_id,
        invoice_number,
        title: proposal.title,
        description: proposal.description,
        line_items: proposal.line_items,
        subtotal_cents: proposal.subtotal_cents,
        discount_type: proposal.discount_type,
        discount_value: proposal.discount_value,
        discount_cents: proposal.discount_cents,
        tax_cents: proposal.tax_cents,
        amount_cents: proposal.amount_cents,
        status: 'draft',
        issued_at,
        due_at: due_at.toISOString(),
        payment_terms: proposal.payment_terms,
        payment_schedule: proposal.payment_schedule,
        project_overview: proposal.project_overview,
        project_start_date: proposal.project_start_date,
        delivery_date: proposal.estimated_delivery_date,
        technology_stack: proposal.technology_stack,
        terms_conditions: proposal.terms_conditions,
        // Copy signature if proposal was signed
        require_signature: false, // Already signed on proposal
        signed_at: proposal.signed_at,
        signer_name: proposal.signer_name,
        signer_email: proposal.signer_email,
        signer_ip: proposal.signer_ip,
        signature_svg: proposal.signature_svg
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating invoice:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update proposal with conversion info
    await supabase
      .from("proposals")
      .update({
        converted_to_invoice_id: invoice.id,
        converted_at: new Date().toISOString()
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      message: "Proposal converted to invoice",
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number
    });
  } catch (error) {
    console.error("Error in POST /api/proposals/[id]/convert:", error);
    return NextResponse.json({ error: "Failed to convert proposal" }, { status: 500 });
  }
}
