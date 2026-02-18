import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { Resend } from "resend";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/proposals/[id]/accept - Client accepts proposal (public endpoint via token)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();

  try {
    const body = await request.json();
    const { token, signer_name, signer_email, signature } = body;

    if (!token) {
      return NextResponse.json({ error: "Access token required" }, { status: 400 });
    }

    // Get proposal by ID and token
    const { data: proposal, error: fetchError } = await supabase
      .from("proposals")
      .select(`
        *, org_id,
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
      return NextResponse.json({ error: "Proposal has been rejected" }, { status: 400 });
    }

    if (proposal.status === 'expired') {
      return NextResponse.json({ error: "Proposal has expired" }, { status: 400 });
    }

    // Check if signature is required and provided
    if (proposal.require_signature && !signature) {
      return NextResponse.json({ error: "Signature is required" }, { status: 400 });
    }

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const signer_ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

    // Update proposal
    const updateData: Record<string, unknown> = {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      signer_name: signer_name || proposal.clients?.name,
      signer_email: signer_email || proposal.clients?.email,
      signer_ip
    };

    if (signature) {
      updateData.signed_at = new Date().toISOString();
      updateData.signature_svg = signature;
    }

    const { error: updateError } = await supabase
      .from("proposals")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Error accepting proposal:", updateError);
      return NextResponse.json({ error: "Failed to accept proposal" }, { status: 500 });
    }

    // Create in-app notification
    if (proposal.org_id) {
      createNotification({
        orgId: proposal.org_id,
        type: 'proposal_accepted',
        title: `Proposal accepted by ${proposal.clients?.name || 'Client'}`,
        body: `${proposal.title} - $${(proposal.amount_cents / 100).toFixed(2)}`,
        link: `/dashboard/proposals`,
      }).catch(err => console.error('[proposal-accept] In-app notification error:', err));
    }

    // Send notification email to business owner
    try {
      await resend.emails.send({
        from: 'NunezDev <notifications@nunezdev.com>',
        to: 'reece@nunezdev.com',
        subject: `Proposal Accepted: ${proposal.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #059669; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Proposal Accepted!</h1>
            </div>
            <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p><strong>${proposal.clients?.name || 'A client'}</strong> has accepted your proposal:</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Proposal:</strong> ${proposal.title}</p>
                <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> $${(proposal.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                <p style="margin: 0;"><strong>Signed by:</strong> ${signer_name || 'N/A'}</p>
              </div>
              <p>You can now convert this proposal to an invoice.</p>
              <div style="text-align: center; margin-top: 20px;">
                <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/proposals" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View in Dashboard</a>
              </div>
            </div>
          </body>
          </html>
        `
      });
    } catch (emailErr) {
      console.error("Error sending acceptance notification:", emailErr);
    }

    return NextResponse.json({ success: true, message: "Proposal accepted successfully" });
  } catch (error) {
    console.error("Error in POST /api/proposals/[id]/accept:", error);
    return NextResponse.json({ error: "Failed to accept proposal" }, { status: 500 });
  }
}
