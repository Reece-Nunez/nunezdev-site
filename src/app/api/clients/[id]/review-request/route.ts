import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";
import { sendTrackedSms } from "@/lib/smsOutbox";
import { normalizePhoneE164 } from "@/lib/sms";
import { reviewRequestSms, reviewRequestEmailHtml } from "@/lib/clientOutreach";

export const runtime = "nodejs";

// POST /api/clients/[id]/review-request - ask the client for a Google review.
// Prefers SMS (higher open rate) when there's a valid phone and no opt-out,
// otherwise falls back to email. Honors SMS opt-out (STOP).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data: client, error } = await supabase
    .from("clients")
    .select("name, email, phone, sms_opted_out_at")
    .eq("id", id)
    .eq("org_id", guard.orgId)
    .single();

  if (error || !client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const phone = client.phone && !client.sms_opted_out_at ? normalizePhoneE164(client.phone) : null;

  if (phone) {
    const res = await sendTrackedSms({
      to: phone,
      body: reviewRequestSms(client.name),
      sentBy: guard.user?.id ?? null,
    });
    if (!res.ok) return NextResponse.json({ error: res.error || "Failed to send SMS" }, { status: 502 });
    return NextResponse.json({ ok: true, channel: "sms" });
  }

  if (client.email) {
    const res = await sendEmail({
      to: client.email,
      subject: "Quick favor: a Google review?",
      html: reviewRequestEmailHtml(client.name),
    });
    if (!res.ok) return NextResponse.json({ error: res.error || "Failed to send email" }, { status: 502 });
    return NextResponse.json({ ok: true, channel: "email" });
  }

  return NextResponse.json(
    { error: "This client has no phone (or opted out) and no email." },
    { status: 400 },
  );
}
