import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  // Create a Supabase client with service role for public access
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { token } = await context.params;

    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    // Fetch invoice by access token (no auth required)
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        title,
        description,
        notes,
        amount_cents,
        subtotal_cents,
        tax_cents,
        discount_cents,
        status,
        issued_at,
        due_at,
        signed_at,
        signer_name,
        signer_email,
        require_signature,
        payment_terms,
        line_items,
        brand_logo_url,
        brand_primary,
        stripe_hosted_invoice_url,
        clients!inner(
          name,
          email,
          company,
          phone
        )
      `)
      .eq("access_token", token)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error fetching public invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}