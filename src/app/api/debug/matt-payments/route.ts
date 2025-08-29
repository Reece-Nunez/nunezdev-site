import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = await supabaseServer();
  
  const mattWilliamsId = "6324ee8e-1f2c-4525-9000-2e64fb261ef4";
  
  try {
    // Get all invoices for Matt Williams
    const { data: invoices, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, status, amount_cents, client_id")
      .eq("client_id", mattWilliamsId);

    // Get all payments for any invoices (Matt Williams or otherwise)
    const { data: allPayments, error: paymentsError } = await supabase
      .from("invoice_payments")
      .select("invoice_id, amount_cents, paid_at")
      .limit(20);

    // Get payments specifically for Matt's invoices (if any exist)
    let mattPayments: any[] = [];
    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map(inv => inv.id);
      const { data: mattPaymentData } = await supabase
        .from("invoice_payments")
        .select("invoice_id, amount_cents, paid_at")
        .in("invoice_id", invoiceIds);
      mattPayments = mattPaymentData || [];
    }

    // Try to find out why the deals/[id] page shows different data
    // Check if there are any invoice payments at all in the system
    const { data: anyPayments, error: anyPaymentsError } = await supabase
      .from("invoice_payments")
      .select("invoice_id, amount_cents")
      .limit(5);

    // Check what the current client_financials view shows
    const { data: viewData, error: viewError } = await supabase
      .from("client_financials")
      .select("*")
      .eq("client_id", mattWilliamsId);

    return NextResponse.json({
      matt_williams_id: mattWilliamsId,
      invoices_for_matt: invoices || [],
      payments_for_matt_invoices: mattPayments || [],
      client_financials_view: viewData || [],
      any_payments_in_system: anyPayments || [],
      all_payments_sample: allPayments?.slice(0, 5) || [],
      errors: {
        invoice_error: invoiceError?.message,
        payments_error: paymentsError?.message,
        any_payments_error: anyPaymentsError?.message,
        view_error: viewError?.message
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      error: "Database query failed", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}