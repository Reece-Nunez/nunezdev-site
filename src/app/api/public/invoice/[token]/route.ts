import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeInvoiceViewUpdate } from "@/lib/invoiceViews";

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
        client_id,
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
        viewed_at,
        last_viewed_at,
        view_count,
        signed_at,
        signer_name,
        signer_email,
        require_signature,
        payment_terms,
        line_items,
        brand_logo_url,
        brand_primary,
        stripe_hosted_invoice_url,
        hosted_invoice_url,
        project_overview,
        project_start_date,
        delivery_date,
        terms_conditions,
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

    // Record the client's view (this route is hit when they open the public
    // link from either the email or the text). Best-effort + debounced so a
    // single visit's duplicate fetches don't inflate the count; a failure here
    // must never break rendering the invoice.
    try {
      const now = new Date().toISOString();
      const update = computeInvoiceViewUpdate(
        {
          viewed_at: invoice.viewed_at ?? null,
          last_viewed_at: invoice.last_viewed_at ?? null,
          view_count: invoice.view_count ?? 0,
        },
        now
      );
      if (update) {
        await supabase.from("invoices").update(update).eq("access_token", token);
        // Reflect the update in the response so the page shows current values.
        Object.assign(invoice, update);
      }
    } catch (viewErr) {
      console.error("Failed to record invoice view:", viewErr);
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error fetching public invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}