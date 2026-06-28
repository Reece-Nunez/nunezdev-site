import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";
import { carePlanEmailHtml } from "@/lib/clientOutreach";

export const runtime = "nodejs";

// POST /api/clients/[id]/care-plan-offer - email the client the care-plan pitch
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data: client, error } = await supabase
    .from("clients")
    .select("name, email")
    .eq("id", id)
    .eq("org_id", guard.orgId)
    .single();

  if (error || !client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!client.email) {
    return NextResponse.json({ error: "This client has no email on file." }, { status: 400 });
  }

  const res = await sendEmail({
    to: client.email,
    subject: "Keeping your site running: care plan options",
    html: carePlanEmailHtml(client.name),
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error || "Failed to send email" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
