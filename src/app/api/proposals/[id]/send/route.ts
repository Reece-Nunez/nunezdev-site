import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { Resend } from "resend";
import { sendProposalSmsWithGuards, proposalUrl } from "@/lib/proposalSms";
import { resolveSendChannel, channelWants } from "@/lib/proposalSend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

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

interface ProposalForSend {
  proposal_number: string;
  title: string;
  description?: string | null;
  amount_cents: number;
  valid_until?: string | null;
  access_token: string;
  status: string;
  clients?: { id: string; name?: string; email?: string; company?: string; phone?: string; sms_opted_out_at?: string | null } | null;
}

/** Build + send the branded proposal email. Returns { ok, error? }. */
async function sendProposalEmail(proposal: ProposalForSend): Promise<{ ok: boolean; error?: string }> {
  if (!proposal.clients?.email) {
    return { ok: false, error: "Client has no email address." };
  }

  const url = proposalUrl(proposal.access_token);
  const { error } = await resend.emails.send({
    from: 'NunezDev <invoices@nunezdev.com>',
    to: proposal.clients.email,
    subject: `Proposal: ${proposal.title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Proposal</h1>
        </div>

        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Hi ${proposal.clients.name || 'there'},</p>

          <p>I've prepared a proposal for you: <strong>${proposal.title}</strong></p>

          ${proposal.description ? `<p style="color: #6b7280;">${proposal.description}</p>` : ''}

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Proposal #:</strong> ${proposal.proposal_number}</p>
            <p style="margin: 0 0 10px 0;"><strong>Total:</strong> $${(proposal.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            ${proposal.valid_until ? `<p style="margin: 0;"><strong>Valid Until:</strong> ${new Date(proposal.valid_until).toLocaleDateString()}</p>` : ''}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="display: inline-block; background: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Proposal</a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">If you have any questions about this proposal, just reply to this email.</p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This proposal was sent by NunezDev<br>
            <a href="${url}" style="color: #059669;">${url}</a>
          </p>
        </div>
      </body>
      </html>
    `
  });

  if (error) {
    console.error("Error sending proposal email:", error);
    return { ok: false, error: "Failed to send email." };
  }
  return { ok: true };
}

// POST /api/proposals/[id]/send - Send proposal to client via email, SMS, or both
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId, user } = auth;

  // Body is optional — a bare POST (legacy "Send"/"Resend" button) defaults to email.
  const body = (await request.json().catch(() => ({}))) as {
    channel?: string;
    to?: string;
    bodyOverride?: string;
  };
  const channel = resolveSendChannel(body.channel);
  // "link" delivers nothing (the operator copied the URL themselves); it only
  // flips draft -> sent so the client's eventual view is tracked.
  const { email: wantEmail, sms: wantSms, link: wantLink } = channelWants(channel);

  try {
    const { data: proposal, error: fetchError } = await supabase
      .from("proposals")
      .select(`
        *,
        clients (id, name, email, company, phone, sms_opted_out_at)
      `)
      .eq("id", id)
      .eq("org_id", orgId)
      .single<ProposalForSend>();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status === 'accepted' || proposal.status === 'rejected') {
      return NextResponse.json(
        { error: "Cannot send a proposal that has already been accepted or rejected" },
        { status: 400 },
      );
    }

    let email: { ok: boolean; error?: string } | undefined;
    let sms: { ok: boolean; error?: string; to?: string } | undefined;

    if (wantEmail) {
      email = await sendProposalEmail(proposal);
    }

    if (wantSms) {
      const result = await sendProposalSmsWithGuards({
        to: body.to,
        clientPhoneOnFile: proposal.clients?.phone ?? null,
        clientOptedOutAt: proposal.clients?.sms_opted_out_at ?? null,
        bodyOverride: body.bodyOverride,
        clientName: proposal.clients?.name ?? null,
        proposalTitle: proposal.title,
        amountCents: proposal.amount_cents,
        accessToken: proposal.access_token,
        sentBy: user.id,
      });
      sms = result.ok ? { ok: true, to: result.to } : { ok: false, error: result.error };
    }

    // A "link" copy has nothing to deliver but still counts as sent.
    const anySucceeded = Boolean(email?.ok) || Boolean(sms?.ok) || wantLink;

    // Only flip to "sent" if something actually went out. A wholesale failure
    // leaves the proposal in draft so the operator can retry.
    if (anySucceeded) {
      const { error: updateError } = await supabase
        .from("proposals")
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq("id", id)
        .eq("org_id", orgId);
      if (updateError) {
        console.error("Error updating proposal status:", updateError);
      }
    }

    if (!anySucceeded) {
      // Every requested channel failed — surface the reason(s).
      const reason = [email?.error, sms?.error].filter(Boolean).join(" ");
      return NextResponse.json(
        { ok: false, channel, email, sms, error: reason || "Failed to send proposal." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, channel, email, sms });
  } catch (error) {
    console.error("Error in POST /api/proposals/[id]/send:", error);
    return NextResponse.json({ error: "Failed to send proposal" }, { status: 500 });
  }
}
