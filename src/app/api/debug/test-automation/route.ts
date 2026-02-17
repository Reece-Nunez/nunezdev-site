import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { invoice_id } = await req.json();
    
    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    
    // Get the current state of the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id, 
        amount_cents, 
        status, 
        client_id, 
        signed_at, 
        signer_name, 
        signer_email,
        total_paid_cents,
        remaining_balance_cents,
        paid_at,
        clients!inner(name, email)
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ 
        error: "Invoice not found", 
        details: invoiceError?.message 
      }, { status: 404 });
    }

    // Get existing payments
    const { data: existingPayments, error: paymentsError } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoice_id);

    // Test 1: Add a payment
    console.log('Adding test payment...');
    const testPaymentData = {
      invoice_id: invoice_id,
      stripe_payment_intent_id: `pi_debug_${Date.now()}`,
      amount_cents: invoice.amount_cents, // Full payment
      payment_method: 'card',
      paid_at: new Date().toISOString(),
      metadata: {
        test_payment: true,
        debug: true
      }
    };

    const { data: paymentData, error: paymentError } = await supabase
      .from('invoice_payments')
      .insert(testPaymentData)
      .select()
      .single();

    // Check invoice status after payment
    const { data: invoiceAfterPayment, error: afterPaymentError } = await supabase
      .from('invoices')
      .select(`
        id, 
        status, 
        amount_cents, 
        total_paid_cents,
        remaining_balance_cents,
        paid_at,
        signed_at,
        signer_name,
        signer_email
      `)
      .eq('id', invoice_id)
      .single();

    // Test 2: Add signature
    console.log('Adding test signature...');
    const testSignatureData = {
      signer_name: (invoice.clients as any)?.name || 'Test Client',
      signer_email: (invoice.clients as any)?.email || 'test@example.com',
      signer_ip: '127.0.0.1',
      signature_svg: '<svg>Debug signature</svg>',
      signed_at: new Date().toISOString()
    };

    const { data: updatedInvoice, error: signatureError } = await supabase
      .from('invoices')
      .update(testSignatureData)
      .eq('id', invoice_id)
      .select(`
        id, 
        status, 
        amount_cents, 
        total_paid_cents,
        remaining_balance_cents,
        paid_at,
        signed_at,
        signer_name,
        signer_email,
        signature_svg,
        signer_ip
      `)
      .single();

    // Calculate final totals
    const { data: allPayments, error: finalPaymentsError } = await supabase
      .from('invoice_payments')
      .select('amount_cents')
      .eq('invoice_id', invoice_id);

    const totalPaid = allPayments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0;

    return NextResponse.json({
      success: true,
      message: "Debug automation test completed",
      debug: {
        original_invoice: invoice,
        existing_payments_before: existingPayments,
        test_payment_data: testPaymentData,
        payment_insert_result: paymentData,
        payment_insert_error: paymentError?.message,
        invoice_after_payment: invoiceAfterPayment,
        after_payment_error: afterPaymentError?.message,
        signature_data: testSignatureData,
        final_invoice: updatedInvoice,
        signature_error: signatureError?.message,
        all_payments_final: allPayments,
        final_payments_error: finalPaymentsError?.message,
        calculated_total_paid: totalPaid
      },
      results: {
        payment_automation: {
          working: invoiceAfterPayment?.status === 'paid' && (invoiceAfterPayment?.total_paid_cents || 0) >= invoice.amount_cents,
          status_changed: invoice.status !== invoiceAfterPayment?.status,
          original_status: invoice.status,
          new_status: invoiceAfterPayment?.status,
          total_paid_cents: invoiceAfterPayment?.total_paid_cents,
          expected_amount: invoice.amount_cents
        },
        signing_automation: {
          working: !!(updatedInvoice?.signed_at && updatedInvoice?.signer_name && updatedInvoice?.signer_email),
          signed_at: updatedInvoice?.signed_at,
          signer_name: updatedInvoice?.signer_name,
          signer_email: updatedInvoice?.signer_email,
          signature_svg_present: !!updatedInvoice?.signature_svg
        }
      }
    });

  } catch (error) {
    console.error("Debug automation test error:", error);
    return NextResponse.json({ 
      error: "Debug test failed", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}