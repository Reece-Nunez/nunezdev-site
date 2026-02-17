import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST() {
  const supabase = await supabaseServer();
  
  console.log("Starting payment correction process...");
  
  try {
    // Fix the incorrect payment amount for invoice d2bdce7b-708e-4ff5-9739-6dbc9b1fecad
    // Current: $625.60 (62560 cents) -> Should be: $75.00 (7500 cents)
    const { data: updatedPayment, error: paymentError } = await supabase
      .from("invoice_payments")
      .update({
        amount_cents: 7500, // Correct amount to match invoice
        metadata: JSON.stringify({
          description: "Corrected payment amount to match invoice",
          manual_payment: true,
          corrected_from: 62560,
          corrected_at: new Date().toISOString()
        })
      })
      .eq("id", "3d22695e-ac19-46c0-ac10-a0e7db3221cf")
      .select();

    if (paymentError) {
      console.error("Error updating payment:", paymentError);
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    // Update the invoice's total_paid_cents to match
    const { data: updatedInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .update({
        total_paid_cents: 7500,
        remaining_balance_cents: 0 // Still fully paid, just correct amount
      })
      .eq("id", "d2bdce7b-708e-4ff5-9739-6dbc9b1fecad")
      .select();

    if (invoiceError) {
      console.error("Error updating invoice:", invoiceError);
      return NextResponse.json({ error: invoiceError.message }, { status: 500 });
    }

    // Get current revenue totals after fix
    const now = new Date();
    const augStart = new Date(now.getFullYear(), 7, 1); // August = month 7 (0-indexed)
    const julStart = new Date(now.getFullYear(), 6, 1); // July = month 6
    const augEnd = new Date(now.getFullYear(), 8, 1); // September = month 8
    const julEnd = new Date(now.getFullYear(), 7, 1); // August = month 7

    // Get August payments
    const { data: augPayments } = await supabase
      .from("invoice_payments")
      .select(`
        amount_cents,
        paid_at,
        invoices!inner(org_id)
      `)
      .eq("invoices.org_id", "38a6ef02-f4dc-43c8-b5ce-bebbb8ff4728")
      .gte("paid_at", augStart.toISOString())
      .lt("paid_at", augEnd.toISOString());

    // Get July payments  
    const { data: julPayments } = await supabase
      .from("invoice_payments")
      .select(`
        amount_cents,
        paid_at,
        invoices!inner(org_id)
      `)
      .eq("invoices.org_id", "38a6ef02-f4dc-43c8-b5ce-bebbb8ff4728")
      .gte("paid_at", julStart.toISOString())
      .lt("paid_at", julEnd.toISOString());

    const augTotal = (augPayments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    const julTotal = (julPayments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0);

    const result = {
      success: true,
      changes: {
        updatedPayment,
        updatedInvoice
      },
      newTotals: {
        august: {
          total_cents: augTotal,
          total_usd: (augTotal / 100).toFixed(2),
          payments: augPayments?.map(p => ({
            amount_usd: (p.amount_cents / 100).toFixed(2),
            paid_at: p.paid_at
          }))
        },
        july: {
          total_cents: julTotal,
          total_usd: (julTotal / 100).toFixed(2),
          payments: julPayments?.map(p => ({
            amount_usd: (p.amount_cents / 100).toFixed(2),
            paid_at: p.paid_at
          }))
        }
      }
    };

    console.log("Payment correction completed:", result);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Unexpected error during payment correction:", error);
    return NextResponse.json({ 
      error: "Payment correction failed", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Payment correction endpoint",
    usage: "POST to fix the incorrect payment amount for invoice d2bdce7b-708e-4ff5-9739-6dbc9b1fecad"
  });
}