import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/public/agreement/[token] - Fetch an agreement by its public token.
// No login required; access is gated by the secret token. Mutations (sign,
// decline) go through the service-role routes, not this read.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = await supabaseServer();

  try {
    const { data: agreement, error } = await supabase
      .from("agreements")
      .select(`
        id,
        agreement_number,
        title,
        summary,
        sections,
        status,
        require_signature,
        valid_until,
        sent_at,
        viewed_at,
        declined_at,
        client_signed_at,
        client_signer_name,
        client_signer_email,
        client_signature_svg,
        dev_signed_at,
        dev_signer_name,
        dev_signature_svg,
        fully_executed_at,
        access_token,
        clients (id, name, email, company, phone)
      `)
      .eq("access_token", token)
      .single();

    if (error || !agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    // Expire once past valid_until (unless already resolved).
    const resolved = ["signed", "countersigned", "declined"].includes(agreement.status);
    if (agreement.valid_until && !resolved) {
      const validUntil = new Date(agreement.valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validUntil < today) {
        await supabase.from("agreements").update({ status: "expired" }).eq("access_token", token);
        agreement.status = "expired";
      }
    }

    // First open of a sent agreement counts as viewed.
    if (agreement.status === "sent" && !agreement.viewed_at) {
      const now = new Date().toISOString();
      await supabase
        .from("agreements")
        .update({ status: "viewed", viewed_at: now })
        .eq("access_token", token);
      agreement.status = "viewed";
      agreement.viewed_at = now;
    }

    return NextResponse.json({ agreement });
  } catch (error) {
    console.error("Error fetching agreement:", error);
    return NextResponse.json({ error: "Failed to fetch agreement" }, { status: 500 });
  }
}
