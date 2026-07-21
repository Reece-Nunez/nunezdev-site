import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";
import { createNotification } from "@/lib/notifications";
import { clientEnrichmentFromSigner } from "@/lib/clientEnrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/agreements/[id]/sign - Owner (client) signs via the public token.
//
// Service-role client (like proposals/accept): the signer is unauthenticated,
// so an RLS-filtered UPDATE would silently write zero rows. Access is gated by
// the secret access_token check below instead.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  try {
    const body = await request.json();
    const { token, signer_name, signer_email, signature } = body;

    if (!token) {
      return NextResponse.json({ error: "Access token required" }, { status: 400 });
    }

    const { data: agreement, error: fetchError } = await supabase
      .from("agreements")
      .select(`*, clients (id, name, email, company)`)
      .eq("id", id)
      .eq("access_token", token)
      .single();

    if (fetchError || !agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    if (agreement.client_signed_at) {
      return NextResponse.json({ error: "This agreement has already been signed." }, { status: 400 });
    }
    if (agreement.status === "declined") {
      return NextResponse.json({ error: "This agreement has been declined." }, { status: 400 });
    }
    if (agreement.status === "expired") {
      return NextResponse.json({ error: "This agreement has expired." }, { status: 400 });
    }
    if (agreement.require_signature && !signature) {
      return NextResponse.json({ error: "Signature is required" }, { status: 400 });
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const signer_ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    const now = new Date().toISOString();

    // If the developer already counter-signed, the client's signature completes
    // execution; otherwise it moves to `signed` awaiting counter-signature.
    const bothSigned = Boolean(agreement.dev_signed_at);

    const updateData: Record<string, unknown> = {
      status: bothSigned ? "countersigned" : "signed",
      client_signed_at: now,
      client_signer_name: signer_name || agreement.clients?.name,
      client_signer_email: signer_email || agreement.clients?.email,
      client_signer_ip: signer_ip,
      client_signature_svg: signature ?? null,
    };
    if (bothSigned) updateData.fully_executed_at = now;

    const { data: updated, error: updateError } = await supabase
      .from("agreements")
      .update(updateData)
      .eq("id", id)
      .select("id");

    if (updateError || !updated || updated.length === 0) {
      console.error("Error signing agreement:", updateError, "rows:", updated?.length);
      return NextResponse.json({ error: "Failed to sign agreement" }, { status: 500 });
    }

    // Backfill client contact info from what the signer typed (gaps only).
    if (agreement.client_id) {
      const patch = clientEnrichmentFromSigner(
        { name: agreement.clients?.name, email: agreement.clients?.email },
        { name: signer_name, email: signer_email },
      );
      if (Object.keys(patch).length > 0) {
        const { error: enrichError } = await supabase
          .from("clients")
          .update({ ...patch, updated_at: now })
          .eq("id", agreement.client_id)
          .eq("org_id", agreement.org_id);
        if (enrichError) console.error("[agreement-sign] client enrichment error:", enrichError);
      }
    }

    if (agreement.org_id) {
      createNotification({
        orgId: agreement.org_id,
        type: "contract_signed",
        title: `Agreement signed by ${signer_name || agreement.clients?.name || "Client"}`,
        body: bothSigned
          ? `${agreement.title} — fully executed`
          : `${agreement.title} — awaiting your counter-signature`,
        link: `/dashboard/agreements/${id}`,
      }).catch((err) => console.error("[agreement-sign] in-app notification error:", err));
    }

    try {
      await resend.emails.send({
        from: "NunezDev <notifications@nunezdev.com>",
        to: "reece@nunezdev.com",
        subject: `Agreement Signed: ${agreement.title}`,
        html: `
          <!DOCTYPE html><html><head><meta charset="utf-8"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #059669; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Agreement Signed</h1>
            </div>
            <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p><strong>${signer_name || agreement.clients?.name || "The client"}</strong> signed:</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Agreement:</strong> ${agreement.title}</p>
                <p style="margin: 0;"><strong>Status:</strong> ${bothSigned ? "Fully executed" : "Awaiting your counter-signature"}</p>
              </div>
              <div style="text-align: center; margin-top: 20px;">
                <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/agreements/${id}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Agreement</a>
              </div>
            </div>
          </body></html>
        `,
      });
    } catch (emailErr) {
      console.error("Error sending sign notification:", emailErr);
    }

    return NextResponse.json({ success: true, fully_executed: bothSigned });
  } catch (error) {
    console.error("Error in POST /api/agreements/[id]/sign:", error);
    return NextResponse.json({ error: "Failed to sign agreement" }, { status: 500 });
  }
}
