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
      .select('id, signed_at, signer_name, signer_email, require_signature, clients(name, email)')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Store original state
    const originalState = {
      signed_at: invoice.signed_at,
      signer_name: invoice.signer_name,
      signer_email: invoice.signer_email
    };

    // Simulate a client signing the invoice
    const testSignatureData = {
      signer_name: invoice.clients?.name || 'Test Client',
      signer_email: invoice.clients?.email || 'test@example.com',
      signer_ip: '127.0.0.1', // Test IP
      signature_svg: '<svg>Test signature</svg>', // Mock signature
      signed_at: new Date().toISOString()
    };

    // Update the invoice with signature data
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update(testSignatureData)
      .eq('id', invoice_id)
      .select('id, signed_at, signer_name, signer_email, signature_svg, signer_ip, require_signature')
      .single();

    if (updateError) {
      return NextResponse.json({ 
        error: "Failed to update invoice with signature", 
        details: updateError.message 
      }, { status: 500 });
    }

    // Verify the signature was recorded
    const signatureWorking = !!(updatedInvoice.signed_at && 
                                updatedInvoice.signer_name && 
                                updatedInvoice.signer_email);

    return NextResponse.json({
      success: true,
      message: "Signing automation test completed",
      results: {
        invoice_requires_signature: invoice.require_signature,
        was_previously_signed: !!originalState.signed_at,
        is_now_signed: !!updatedInvoice.signed_at,
        signer_name: updatedInvoice.signer_name,
        signer_email: updatedInvoice.signer_email,
        signed_at: updatedInvoice.signed_at,
        automation_working: signatureWorking
      },
      test_data: {
        original_state: originalState,
        updated_state: {
          signed_at: updatedInvoice.signed_at,
          signer_name: updatedInvoice.signer_name,
          signer_email: updatedInvoice.signer_email,
          signature_svg: updatedInvoice.signature_svg ? 'Present' : 'Missing'
        }
      }
    });

  } catch (error) {
    console.error("Signing automation test error:", error);
    return NextResponse.json({ 
      error: "Test failed", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}