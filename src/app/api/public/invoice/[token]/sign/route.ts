import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { token } = await context.params;
    const { signatureData, signerName, signerEmail } = await req.json();

    if (!token || !signatureData || !signerName || !signerEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify token exists and invoice requires signature
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("id, require_signature, signed_at, org_id, invoice_number")
      .eq("access_token", token)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!invoice.require_signature) {
      return NextResponse.json({ error: "Invoice does not require signature" }, { status: 400 });
    }

    if (invoice.signed_at) {
      return NextResponse.json({ error: "Invoice already signed" }, { status: 400 });
    }

    // Update invoice with signature
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        signed_at: new Date().toISOString(),
        signer_name: signerName,
        signer_email: signerEmail,
        signature_svg: signatureData,
      })
      .eq("access_token", token);

    if (updateError) {
      return NextResponse.json({ error: "Failed to save signature" }, { status: 500 });
    }

    // Create in-app notification
    if (invoice.org_id) {
      createNotification({
        orgId: invoice.org_id,
        type: 'contract_signed',
        title: `Contract signed by ${signerName}`,
        body: invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : undefined,
        link: `/dashboard/invoices/${invoice.id}`,
      }).catch(err => console.error('[public-sign] In-app notification error:', err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error signing invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}