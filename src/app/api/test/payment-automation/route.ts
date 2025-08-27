import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOwner } from "@/lib/authz";

export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const { invoice_id } = await req.json();
    
    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    
    // First, get the invoice to verify it exists
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, amount_cents, status, client_id, clients(name, email)')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Simulate a Stripe payment by inserting a test payment record
    const testPaymentData = {
      invoice_id: invoice_id,
      stripe_payment_intent_id: `pi_test_${Date.now()}`, // Mock payment intent ID
      amount_cents: invoice.amount_cents, // Full payment
      payment_method: 'card',
      paid_at: new Date().toISOString(),
      metadata: {
        test_payment: true,
        payment_intent_id: `pi_test_${Date.now()}`,
        customer_email: invoice.clients?.email || 'test@example.com'
      }
    };

    // Insert the test payment
    const { data: paymentData, error: paymentError } = await supabase
      .from('invoice_payments')
      .insert(testPaymentData)
      .select()
      .single();

    if (paymentError) {
      return NextResponse.json({ 
        error: "Failed to create test payment", 
        details: paymentError.message 
      }, { status: 500 });
    }

    // Check if invoice status was automatically updated
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .select('id, status, amount_cents, invoice_payments(amount_cents)')
      .eq('id', invoice_id)
      .single();

    if (updateError) {
      return NextResponse.json({ 
        error: "Failed to check updated invoice", 
        details: updateError.message 
      }, { status: 500 });
    }

    // Calculate total payments
    const totalPaid = updatedInvoice.invoice_payments?.reduce((sum: number, payment: any) => sum + payment.amount_cents, 0) || 0;

    return NextResponse.json({
      success: true,
      message: "Payment automation test completed",
      results: {
        original_status: invoice.status,
        updated_status: updatedInvoice.status,
        invoice_amount: invoice.amount_cents,
        total_paid: totalPaid,
        test_payment_id: paymentData.id,
        automation_working: updatedInvoice.status === 'paid' && totalPaid >= invoice.amount_cents
      },
      test_data: {
        payment_record: paymentData,
        invoice_before: invoice,
        invoice_after: updatedInvoice
      }
    });

  } catch (error) {
    console.error("Payment automation test error:", error);
    return NextResponse.json({ 
      error: "Test failed", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}