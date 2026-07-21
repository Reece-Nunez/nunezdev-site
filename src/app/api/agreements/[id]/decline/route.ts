import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/agreements/[id]/decline - Client declines via the public token.
// Service-role client, gated by the access_token check (see sign route).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  try {
    const body = await request.json();
    const { token, reason } = body;

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
      return NextResponse.json({ error: "This agreement has already been declined." }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("agreements")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
        decline_reason: reason || null,
      })
      .eq("id", id)
      .select("id");

    if (updateError || !updated || updated.length === 0) {
      console.error("Error declining agreement:", updateError, "rows:", updated?.length);
      return NextResponse.json({ error: "Failed to decline agreement" }, { status: 500 });
    }

    try {
      await resend.emails.send({
        from: "NunezDev <notifications@nunezdev.com>",
        to: "reece@nunezdev.com",
        subject: `Agreement Declined: ${agreement.title}`,
        html: `
          <!DOCTYPE html><html><head><meta charset="utf-8"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #dc2626; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Agreement Declined</h1>
            </div>
            <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p><strong>${agreement.clients?.name || "A client"}</strong> declined:</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Agreement:</strong> ${agreement.title}</p>
                ${reason ? `<p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>` : ""}
              </div>
            </div>
          </body></html>
        `,
      });
    } catch (emailErr) {
      console.error("Error sending decline notification:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/agreements/[id]/decline:", error);
    return NextResponse.json({ error: "Failed to decline agreement" }, { status: 500 });
  }
}
