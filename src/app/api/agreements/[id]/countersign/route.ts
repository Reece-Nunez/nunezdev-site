import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/agreements/[id]/countersign - The Developer (operator) counter-signs
// from the dashboard. Authed + org-scoped. If the client already signed, this
// fully executes the agreement; otherwise the counter-signature is stored and
// execution completes when the client signs.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = m?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  try {
    const body = await request.json();
    const { signer_name, signature } = body;

    if (!signature) {
      return NextResponse.json({ error: "Signature is required" }, { status: 400 });
    }

    const { data: agreement, error: fetchError } = await supabase
      .from("agreements")
      .select("id, status, dev_signed_at, client_signed_at, title")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }
    if (agreement.dev_signed_at) {
      return NextResponse.json({ error: "You have already counter-signed this agreement." }, { status: 400 });
    }
    if (agreement.status === "declined" || agreement.status === "expired") {
      return NextResponse.json({ error: `Cannot counter-sign a ${agreement.status} agreement.` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const clientAlreadySigned = Boolean(agreement.client_signed_at);

    const updateData: Record<string, unknown> = {
      dev_signed_at: now,
      dev_signer_name: signer_name || "Reece Nunez",
      dev_signature_svg: signature,
    };
    // Only advance status to countersigned when the client has already signed.
    // Otherwise keep the current pipeline status (draft/sent/viewed) — the
    // agreement isn't executed until the Owner signs too.
    if (clientAlreadySigned) {
      updateData.status = "countersigned";
      updateData.fully_executed_at = now;
    }

    const { data: updated, error: updateError } = await supabase
      .from("agreements")
      .update(updateData)
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (updateError) {
      console.error("Error counter-signing agreement:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ agreement: updated, fully_executed: clientAlreadySigned });
  } catch (error) {
    console.error("Error in POST /api/agreements/[id]/countersign:", error);
    return NextResponse.json({ error: "Failed to counter-sign agreement" }, { status: 500 });
  }
}
