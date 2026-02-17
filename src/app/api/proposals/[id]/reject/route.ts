import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/proposals/[id]/reject - Client rejects proposal (public endpoint via token)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();

  try {
    const body = await request.json();
    const { token, reason } = body;

    if (!token) {
      return NextResponse.json({ error: "Access token required" }, { status: 400 });
    }

    // Get proposal by ID and token
    const { data: proposal, error: fetchError } = await supabase
      .from("proposals")
      .select(`
        *,
        clients (id, name, email, company)
      `)
      .eq("id", id)
      .eq("access_token", token)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status === 'accepted') {
      return NextResponse.json({ error: "Proposal has already been accepted" }, { status: 400 });
    }

    if (proposal.status === 'rejected') {
      return NextResponse.json({ error: "Proposal has already been rejected" }, { status: 400 });
    }

    // Update proposal
    const { error: updateError } = await supabase
      .from("proposals")
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || null
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error rejecting proposal:", updateError);
      return NextResponse.json({ error: "Failed to reject proposal" }, { status: 500 });
    }

    // Send notification email to business owner
    try {
      await resend.emails.send({
        from: 'NunezDev <notifications@nunezdev.com>',
        to: 'reece@nunezdev.com',
        subject: `Proposal Declined: ${proposal.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #dc2626; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Proposal Declined</h1>
            </div>
            <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p><strong>${proposal.clients?.name || 'A client'}</strong> has declined your proposal:</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Proposal:</strong> ${proposal.title}</p>
                <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> $${(proposal.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                ${reason ? `<p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
              </div>
              <p>Consider following up to understand their concerns.</p>
            </div>
          </body>
          </html>
        `
      });
    } catch (emailErr) {
      console.error("Error sending rejection notification:", emailErr);
    }

    return NextResponse.json({ success: true, message: "Proposal declined" });
  } catch (error) {
    console.error("Error in POST /api/proposals/[id]/reject:", error);
    return NextResponse.json({ error: "Failed to reject proposal" }, { status: 500 });
  }
}
