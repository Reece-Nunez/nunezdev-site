import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

const REUSABLE_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;

  try {
    const { installment_id } = await request.json();

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

    if (invoice.status === "paid") {
      return NextResponse.json(
        { error: "Invoice is already paid" },
        { status: 400 }
      );
    }

    let amount = invoice.amount_cents;
    let description = `Invoice ${invoice.invoice_number || invoice.id.split('-')[0]}`;
    let metadata: Record<string, string> = {
      invoice_id: invoice.id,
      org_id: invoice.org_id,
      client_id: invoice.client_id,
      invoice_number: invoice.invoice_number || '',
      client_email: invoice.clients?.email || '',
      client_name: invoice.clients?.name || '',
      source: 'custom_payment_page',
    };

    // Track which DB table/record to persist the payment intent ID to
    let installment: any = null;

    if (installment_id) {
      const { data: inst, error: installmentError } = await supabase
        .from("invoice_payment_plans")
        .select("*")
        .eq("id", installment_id)
        .eq("invoice_id", invoiceId)
        .single();

      if (installmentError || !inst) {
        return NextResponse.json(
          { error: "Installment not found" },
          { status: 404 }
        );
      }

      if (inst.status === "paid") {
        return NextResponse.json(
          { error: "Installment is already paid" },
          { status: 400 }
        );
      }

      installment = inst;
      amount = inst.amount_cents;
      description = `${invoice.invoice_number || invoice.id.split('-')[0]} - ${inst.installment_label}`;
      metadata.installment_id = inst.id;
      metadata.installment_label = inst.installment_label;
      metadata.installment_number = inst.installment_number.toString();
    }

    // --- Try to reuse an existing payment intent from the DB ---
    const existingIntentId = installment
      ? installment.stripe_payment_intent_id
      : invoice.stripe_payment_intent_id;

    if (existingIntentId) {
      try {
        const existing = await stripe.paymentIntents.retrieve(existingIntentId);

        if (REUSABLE_STATUSES.has(existing.status) && existing.amount === amount) {
          console.log(`[create-payment-intent] Reusing existing intent ${existing.id} for invoice ${invoiceId}`);
          return NextResponse.json({
            clientSecret: existing.client_secret,
            amount: amount,
            invoice_number: invoice.invoice_number || invoice.id.split('-')[0],
          });
        }

        // If the amount changed, cancel the stale intent and create a fresh one
        if (REUSABLE_STATUSES.has(existing.status) && existing.amount !== amount) {
          console.log(`[create-payment-intent] Canceling stale intent ${existing.id} (amount mismatch: ${existing.amount} vs ${amount})`);
          await stripe.paymentIntents.cancel(existing.id);
        }
      } catch (retrieveError: any) {
        // Intent doesn't exist in Stripe anymore — fall through to create a new one
        console.warn(`[create-payment-intent] Could not retrieve existing intent ${existingIntentId}:`, retrieveError.message);
      }
    }

    // --- Create a new PaymentIntent ---
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      description,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log(`[create-payment-intent] Created new intent ${paymentIntent.id} for invoice ${invoiceId}${installment ? ` installment ${installment_id}` : ''}`);

    // Persist the intent ID so we can reuse it on subsequent page loads
    if (installment) {
      await supabase
        .from("invoice_payment_plans")
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq("id", installment_id);
    } else {
      await supabase
        .from("invoices")
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq("id", invoiceId);
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: amount,
      invoice_number: invoice.invoice_number || invoice.id.split('-')[0],
    });
  } catch (error: any) {
    console.error(`[create-payment-intent] Error for invoice ${invoiceId}:`, error);

    // Return a more specific error for Stripe errors
    const message = error?.type?.startsWith("Stripe")
      ? `Payment processing error: ${error.message}`
      : "Failed to create payment intent";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
