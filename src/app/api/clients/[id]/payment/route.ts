import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;
  
  const { id: clientId } = await context.params;
  const { amount_cents, description, payment_method, paid_at } = await req.json();

  if (!amount_cents || !description || !payment_method || !paid_at) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await supabaseServer();

  try {
    // Verify client belongs to org
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("org_id", orgId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Create a manual payment invoice first
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        client_id: clientId,
        amount_cents,
        status: "paid",
        source: "manual",
        issued_at: paid_at,
        paid_at,
        description: `Manual payment: ${description}`,
      })
      .select("id")
      .single();

    if (invoiceError) {
      console.error("Error creating manual payment invoice:", invoiceError);
      return NextResponse.json({ error: "Failed to create payment invoice" }, { status: 500 });
    }

    // Create the payment record
    const { data: payment, error: paymentError } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: invoice.id,
        amount_cents,
        payment_method,
        paid_at,
        metadata: {
          description,
          manual_payment: true,
        },
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
      // Try to clean up the invoice if payment creation failed
      await supabase.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json({ error: "Failed to create payment record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, payment, invoice });
  } catch (error) {
    console.error("Error in manual payment creation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}