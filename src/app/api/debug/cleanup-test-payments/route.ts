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
    
    // Find and delete test payments (those with debug/test metadata)
    const { data: testPayments, error: findError } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoice_id)
      .or('metadata->>test_payment.eq.true,metadata->>debug.eq.true,stripe_payment_intent_id.like.pi_test_%,stripe_payment_intent_id.like.pi_debug_%');

    if (findError) {
      return NextResponse.json({ 
        error: "Failed to find test payments", 
        details: findError.message 
      }, { status: 500 });
    }

    if (!testPayments || testPayments.length === 0) {
      return NextResponse.json({ 
        message: "No test payments found for this invoice",
        invoice_id 
      });
    }

    // Delete the test payments
    const { error: deleteError } = await supabase
      .from('invoice_payments')
      .delete()
      .eq('invoice_id', invoice_id)
      .or('metadata->>test_payment.eq.true,metadata->>debug.eq.true,stripe_payment_intent_id.like.pi_test_%,stripe_payment_intent_id.like.pi_debug_%');

    if (deleteError) {
      return NextResponse.json({ 
        error: "Failed to delete test payments", 
        details: deleteError.message 
      }, { status: 500 });
    }

    // Get the updated invoice status (triggers should have updated it automatically)
    const { data: updatedInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
        status,
        amount_cents,
        total_paid_cents,
        remaining_balance_cents,
        paid_at,
        signed_at
      `)
      .eq('id', invoice_id)
      .single();

    // Also remove any test signature data if it was added
    const { error: signatureCleanupError } = await supabase
      .from('invoices')
      .update({
        signed_at: null,
        signer_ip: null,
        signature_svg: null
      })
      .eq('id', invoice_id)
      .like('signature_svg', '%Debug signature%');

    return NextResponse.json({
      success: true,
      message: "Test payments and signature data cleaned up successfully",
      removed_payments: testPayments,
      invoice_after_cleanup: updatedInvoice,
      signature_cleanup_error: signatureCleanupError?.message || null
    });

  } catch (error) {
    console.error("Cleanup test payments error:", error);
    return NextResponse.json({ 
      error: "Cleanup failed", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}