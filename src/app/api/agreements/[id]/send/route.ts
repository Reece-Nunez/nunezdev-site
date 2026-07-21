import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { Resend } from "resend";
import {
  resolveAgreementChannel,
  agreementChannelWants,
  agreementUrl,
} from "@/lib/agreements/share";
import { sendAgreementSmsWithGuards } from "@/lib/agreements/sms";

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

interface AgreementForSend {
  agreement_number: string;
  title: string;
  summary?: string | null;
  valid_until?: string | null;
  access_token: string;
  status: string;
  clients?: {
    id: string;
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
    sms_opted_out_at?: string | null;
  } | null;
}

async function sendAgreementEmail(agreement: AgreementForSend): Promise<{ ok: boolean; error?: string }> {
  if (!agreement.clients?.email) {
    return { ok: false, error: "Client has no email address." };
  }
  const url = agreementUrl(agreement.access_token);
  const { error } = await resend.emails.send({
    from: "NunezDev <invoices@nunezdev.com>",
    to: agreement.clients.email,
    subject: `Agreement: ${agreement.title}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0b2a4a 0%, #123a63 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Agreement for Review</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Hi ${agreement.clients.name || "there"},</p>
          <p>Please review and sign this agreement: <strong>${agreement.title}</strong></p>
          ${agreement.summary ? `<p style="color: #6b7280;">${agreement.summary}</p>` : ""}
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Agreement #:</strong> ${agreement.agreement_number}</p>
            ${agreement.valid_until ? `<p style="margin: 0;"><strong>Valid Until:</strong> ${new Date(agreement.valid_until).toLocaleDateString()}</p>` : ""}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="display: inline-block; background: #ffc312; color: #111; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700;">Review &amp; Sign</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you have any questions, just reply to this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Sent by NunezDev<br><a href="${url}" style="color: #0b2a4a;">${url}</a>
          </p>
        </div>
      </body></html>
    `,
  });
  if (error) {
    console.error("Error sending agreement email:", error);
    return { ok: false, error: "Failed to send email." };
  }
  return { ok: true };
}

// POST /api/agreements/[id]/send - Send via email, SMS, both, or "link" (mark sent only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuthedOrgId();
  if (!auth.ok) return NextResponse.json(auth.json, { status: auth.status });
  const { supabase, orgId, user } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    channel?: string;
    to?: string;
    bodyOverride?: string;
  };
  const channel = resolveAgreementChannel(body.channel);
  const { email: wantEmail, sms: wantSms, link: wantLink } = agreementChannelWants(channel);

  try {
    const { data: agreement, error: fetchError } = await supabase
      .from("agreements")
      .select(`*, clients (id, name, email, company, phone, sms_opted_out_at)`)
      .eq("id", id)
      .eq("org_id", orgId)
      .single<AgreementForSend>();

    if (fetchError || !agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    if (["signed", "countersigned", "declined"].includes(agreement.status)) {
      return NextResponse.json(
        { error: "Cannot send an agreement that has already been signed or declined." },
        { status: 400 },
      );
    }

    let email: { ok: boolean; error?: string } | undefined;
    let sms: { ok: boolean; error?: string; to?: string } | undefined;

    if (wantEmail) {
      email = await sendAgreementEmail(agreement);
    }

    if (wantSms) {
      const result = await sendAgreementSmsWithGuards({
        to: body.to,
        clientPhoneOnFile: agreement.clients?.phone ?? null,
        clientOptedOutAt: agreement.clients?.sms_opted_out_at ?? null,
        bodyOverride: body.bodyOverride,
        clientName: agreement.clients?.name ?? null,
        title: agreement.title,
        accessToken: agreement.access_token,
        sentBy: user.id,
      });
      sms = result.ok ? { ok: true, to: result.to } : { ok: false, error: result.error };
    }

    const anySucceeded = Boolean(email?.ok) || Boolean(sms?.ok) || wantLink;

    // Only flip draft -> sent when something actually went out. A resend of an
    // already sent/viewed agreement leaves its status (and the "viewed" signal)
    // untouched.
    if (anySucceeded && agreement.status === "draft") {
      const { error: updateError } = await supabase
        .from("agreements")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id)
        .eq("org_id", orgId);
      if (updateError) console.error("Error updating agreement status:", updateError);
    }

    if (!anySucceeded) {
      const reason = [email?.error, sms?.error].filter(Boolean).join(" ");
      return NextResponse.json(
        { ok: false, channel, email, sms, error: reason || "Failed to send agreement." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, channel, email, sms });
  } catch (error) {
    console.error("Error in POST /api/agreements/[id]/send:", error);
    return NextResponse.json({ error: "Failed to send agreement" }, { status: 500 });
  }
}
