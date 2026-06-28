import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTrackedSms } from "@/lib/smsOutbox";
import { normalizePhoneE164 } from "@/lib/sms";

export const runtime = "nodejs";

// POST /api/leads/[id]/sms - send a one-off SMS reply to a lead.
// This is a human-initiated 1:1 response to an inbound inquiry (not bulk
// marketing), so it doesn't require prior opt-in, but it always honors an
// explicit opt-out (STOP).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: string;
  try {
    body = (await req.json())?.body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("phone, sms_opted_out_at")
    .eq("id", id)
    .single();

  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (lead.sms_opted_out_at) {
    return NextResponse.json(
      { error: "This lead has opted out of SMS (replied STOP). Reach them another way." },
      { status: 409 },
    );
  }

  const to = lead.phone ? normalizePhoneE164(lead.phone) : null;
  if (!to) {
    return NextResponse.json({ error: "This lead has no valid phone number." }, { status: 400 });
  }

  const result = await sendTrackedSms({ to, body: body.trim(), sentBy: guard.user?.id ?? null });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Failed to send SMS" }, { status: 502 });
  }

  // Mark first contact made.
  await supabase
    .from("leads")
    .update({ last_contact: new Date().toISOString(), status: "contacted" })
    .eq("id", id)
    .eq("status", "new"); // only advance an untouched lead; don't downgrade later stages

  return NextResponse.json({ ok: true });
}
