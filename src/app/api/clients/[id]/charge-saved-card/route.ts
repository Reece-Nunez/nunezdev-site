import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/authz";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { id: clientId } = await context.params;
  const { payment_method_id, invoice_id, amount_cents, installment_id } = await req.json();

  if (!payment_method_id || !invoice_id || !amount_cents) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await supabaseServer();

  // Verify client belongs to org and has stripe_customer_id
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, stripe_customer_id")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.stripe_customer_id) {
    return NextResponse.json(
      { error: "Client has no saved payment methods" },
      { status: 400 }
    );
  }

  // Verify invoice exists, belongs to this client, and is not fully paid
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, amount_cents, invoice_number, client_id, org_id")
    .eq("id", invoice_id)
    .eq("client_id", clientId)
    .eq("org_id", orgId)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: "usd",
      customer: client.stripe_customer_id,
      payment_method: payment_method_id,
      off_session: true,
      confirm: true,
      metadata: {
        invoice_id: invoice.id,
        org_id: orgId,
        client_id: clientId,
        client_email: client.email || "",
        client_name: client.name || "",
        invoice_number: invoice.invoice_number || "",
        source: "saved_card_charge",
        ...(installment_id ? { installment_id } : {}),
      },
    });

    if (paymentIntent.status === "succeeded") {
      return NextResponse.json({
        success: true,
        payment_intent_id: paymentIntent.id,
      });
    }

    if (paymentIntent.status === "requires_action") {
      // Cancel the intent since we can't complete 3DS off-session
      await stripe.paymentIntents.cancel(paymentIntent.id);
      return NextResponse.json(
        {
          error:
            "This card requires customer authentication (3D Secure). Please send the client a payment link instead.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `Unexpected payment status: ${paymentIntent.status}` },
      { status: 400 }
    );
  } catch (error: any) {
    // Handle Stripe card errors (declined, insufficient funds, etc.)
    if (error.type === "StripeCardError") {
      return NextResponse.json(
        { error: `Card declined: ${error.message}` },
        { status: 400 }
      );
    }

    console.error("Error charging saved card:", error);
    return NextResponse.json(
      { error: "Failed to charge card" },
      { status: 500 }
    );
  }
}
