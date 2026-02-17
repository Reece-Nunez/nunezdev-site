import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { paymentIntentId, invoiceId, amount, billingEmail } = await req.json();
    
    if (!paymentIntentId || !invoiceId || !amount) {
      return NextResponse.json({ 
        error: "Missing required fields: paymentIntentId, invoiceId, amount" 
      }, { status: 400 });
    }

    console.log('[manual-payment] Processing missed payment:', {
      paymentIntentId,
      invoiceId, 
      amount,
      billingEmail
    });

    const supabase = supabaseAdmin();

    // Check if payment already exists
    const { data: existingPayment } = await supabase
      .from('invoice_payments')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (existingPayment) {
      return NextResponse.json({ 
        error: "Payment already processed",
        payment_id: existingPayment.id 
      }, { status: 409 });
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
        client_id,
        amount_cents,
        status,
        clients!inner(name, email)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ 
        error: "Invoice not found",
        details: invoiceError 
      }, { status: 404 });
    }

    // Add payment record
    const { data: payment, error: paymentError } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: invoiceId,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: amount,
        payment_method: 'card',
        paid_at: new Date().toISOString(),
        metadata: {
          payment_intent_id: paymentIntentId,
          manual_processing: true,
          billing_email: billingEmail,
          processed_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (paymentError) {
      return NextResponse.json({ 
        error: "Failed to add payment record",
        details: paymentError 
      }, { status: 500 });
    }

    // Add activity log
    await supabase
      .from('client_activity_log')
      .insert({
        invoice_id: invoiceId,
        client_id: invoice.client_id,
        activity_type: 'payment_completed',
        activity_data: {
          amount_cents: amount,
          payment_intent_id: paymentIntentId,
          manual_processing: true
        }
      });

    console.log('[manual-payment] Successfully processed payment:', {
      paymentId: payment.id,
      invoiceId,
      amount
    });

    return NextResponse.json({
      success: true,
      payment_id: payment.id,
      invoice: {
        id: invoice.id,
        client_name: (invoice.clients as any).name,
        client_email: (invoice.clients as any).email,
        amount_cents: invoice.amount_cents,
        status: invoice.status
      },
      message: "Payment processed successfully. Invoice status will be updated automatically."
    });

  } catch (error) {
    console.error('[manual-payment] Error:', error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}