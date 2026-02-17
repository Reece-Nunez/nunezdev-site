import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const { installment_id } = await request.json();

    // Use service role client for public access (no auth required)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        clients (
          id,
          name,
          email,
          company
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    let amount = invoice.amount_cents;
    let description = `Invoice ${invoice.invoice_number || invoice.id.split('-')[0]}`;
    let metadata: any = {
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      invoice_number: invoice.invoice_number || '',
      client_email: invoice.clients?.email || '',
      client_name: invoice.clients?.name || '',
      source: 'custom_payment_page',
    };

    // If this is for a specific installment, get those details
    if (installment_id) {
      const { data: installment, error: installmentError } = await supabase
        .from("invoice_payment_plans")
        .select("*")
        .eq("id", installment_id)
        .eq("invoice_id", invoiceId)
        .single();

      if (!installmentError && installment) {
        amount = installment.amount_cents;
        description = `${invoice.invoice_number || invoice.id.split('-')[0]} - ${installment.installment_label}`;
        metadata.installment_id = installment.id;
        metadata.installment_label = installment.installment_label;
        metadata.installment_number = installment.installment_number.toString();
      }
    }

    // Check for an existing reusable payment intent to prevent duplicates
    const idempotencyKey = installment_id
      ? `pi-${invoiceId}-inst-${installment_id}`
      : `pi-${invoiceId}-full`;

    // Search for an existing incomplete payment intent for this invoice/installment
    const existingIntents = await stripe.paymentIntents.search({
      query: `metadata["invoice_id"]:"${invoiceId}"${
        installment_id ? ` AND metadata["installment_id"]:"${installment_id}"` : ' AND -metadata["installment_id"]:*'
      } AND status:"requires_payment_method"`,
      limit: 1,
    });

    let paymentIntent: Stripe.PaymentIntent;

    if (existingIntents.data.length > 0 && existingIntents.data[0].amount === amount) {
      // Reuse the existing incomplete payment intent
      paymentIntent = existingIntents.data[0];
      console.log(`[create-payment-intent] Reusing existing intent ${paymentIntent.id} for invoice ${invoiceId}`);
    } else {
      // Create a new PaymentIntent with idempotency key
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amount,
          currency: 'usd',
          description: description,
          metadata: metadata,
          automatic_payment_methods: {
            enabled: true,
          },
        },
        { idempotencyKey }
      );
      console.log(`[create-payment-intent] Created new intent ${paymentIntent.id} for invoice ${invoiceId}`);
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: amount,
      invoice_number: invoice.invoice_number || invoice.id.split('-')[0],
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
