import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/public/proposal/[token] - Get proposal by public token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await supabaseServer();

  try {
    const { data: proposal, error } = await supabase
      .from("proposals")
      .select(`
        id,
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
        status,
        valid_until,
        sent_at,
        viewed_at,
        accepted_at,
        rejected_at,
        require_signature,
        signed_at,
        signer_name,
        project_overview,
        project_start_date,
        estimated_delivery_date,
        technology_stack,
        terms_conditions,
        payment_terms,
        payment_schedule,
        access_token,
        clients (
          id,
          name,
          email,
          company,
          phone
        )
      `)
      .eq("access_token", token)
      .single();

    if (error || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // Check if expired
    if (proposal.valid_until) {
      const validUntil = new Date(proposal.valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validUntil < today && proposal.status !== 'accepted' && proposal.status !== 'rejected') {
        // Mark as expired
        await supabase
          .from("proposals")
          .update({ status: 'expired' })
          .eq("access_token", token);
        proposal.status = 'expired';
      }
    }

    // Mark as viewed if sent
    if (proposal.status === 'sent' && !proposal.viewed_at) {
      await supabase
        .from("proposals")
        .update({
          status: 'viewed',
          viewed_at: new Date().toISOString()
        })
        .eq("access_token", token);
      proposal.status = 'viewed';
      proposal.viewed_at = new Date().toISOString();
    }

    return NextResponse.json({ proposal });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    return NextResponse.json({ error: "Failed to fetch proposal" }, { status: 500 });
  }
}
