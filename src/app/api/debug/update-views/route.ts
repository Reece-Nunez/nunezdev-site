import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST() {
  const supabase = await supabaseServer();
  
  try {
    // Try to update the client_financials view to include 'partially_paid' status
    const updatedViewSQL = `
CREATE OR REPLACE VIEW client_financials AS
SELECT
  c.id AS client_id,
  COALESCE(SUM(CASE WHEN i.status IN ('sent','paid','overdue','partially_paid') THEN i.amount_cents ELSE 0 END), 0) AS total_invoiced_cents,
  COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount_cents ELSE 0 END), 0) AS total_paid_cents,
  COALESCE(SUM(CASE WHEN i.status IN ('sent','overdue','partially_paid') THEN i.amount_cents ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount_cents ELSE 0 END), 0) AS balance_due_cents,
  COALESCE(SUM(CASE WHEN i.status = 'draft' THEN i.amount_cents ELSE 0 END), 0) AS draft_invoiced_cents
FROM clients c
LEFT JOIN invoices i ON i.client_id = c.id
GROUP BY c.id;
    `;

    // Since we can't execute raw SQL directly through Supabase client, 
    // let's check what the current data looks like and see if we can identify the issue
    
    // Check the current client_financials view
    const { data: financials, error: financialError } = await supabase
      .from("client_financials")
      .select("*")
      .limit(10);

    // Check specific client's data
    const alphonseId = "222e5ef5-8b06-41ca-a446-b23274f859f4";
    const { data: alphonseFinancials, error: alphonseError } = await supabase
      .from("client_financials")
      .select("*")
      .eq("client_id", alphonseId);

    // Check if we can find Alphonse's invoice through a direct query
    const { data: alphonseInvoices, error: invoiceError } = await supabase
      .from("invoices") 
      .select("id, status, amount_cents, client_id, org_id")
      .eq("client_id", alphonseId);

    // Check all partially_paid invoices in the system
    const { data: partiallyPaidInvoices, error: partialError } = await supabase
      .from("invoices")
      .select("id, client_id, status, amount_cents")
      .eq("status", "partially_paid")
      .limit(10);

    return NextResponse.json({
      message: "Cannot execute CREATE VIEW directly via API. Manual database access required.",
      sql_needed: updatedViewSQL,
      current_financials_data: financials,
      alphonse_financials: alphonseFinancials,
      alphonse_invoices: alphonseInvoices,
      all_partially_paid_invoices: partiallyPaidInvoices,
      errors: {
        financial_error: financialError?.message,
        alphonse_error: alphonseError?.message,
        invoice_error: invoiceError?.message,
        partial_error: partialError?.message
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      error: "Failed to check database state", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}