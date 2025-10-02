import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
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

    const supabase = await supabaseServer();

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
        .single();

      if (!installmentError && installment) {
        amount = installment.amount_cents;
        description = `${invoice.invoice_number || invoice.id.split('-')[0]} - ${installment.installment_label}`;
        metadata.installment_id = installment.id;
        metadata.installment_label = installment.installment_label;
        metadata.installment_number = installment.installment_number.toString();
      }
    }

    // Create a PaymentIntent with Stripe
    // Automatically includes all payment methods enabled in your Stripe dashboard
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      description: description,
      metadata: metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

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
