import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  try {
    console.log('Updating client_financials view for partial payments...');
    
    // We need to check if the partial payment columns exist first
    const supabase = supabaseAdmin();
    
    // Check if the required columns exist by trying to query them directly
    const { data: testQuery, error: columnError } = await supabase
      .from('invoices')
      .select('total_paid_cents, remaining_balance_cents')
      .limit(1)
      .maybeSingle();
    
    if (columnError && columnError.code === 'PGRST116') {
      console.log('Columns do not exist, migration needed');
      return NextResponse.json({ 
        error: 'Please run the partial payments SQL migration first. The required columns (total_paid_cents, remaining_balance_cents) do not exist in the invoices table.',
        migration_needed: 'src/sql/add_partial_payments_support.sql'
      }, { status: 400 });
    }
    
    console.log('Required columns exist, updating view...');
    
    // Execute the SQL to update the client_financials view
    const { error: viewError } = await supabase.rpc('sql', {
      query: `
        CREATE OR REPLACE VIEW client_financials AS
        SELECT
          c.id as client_id,
          -- Total invoiced: sum of all sent/paid/overdue/partially_paid invoices
          COALESCE(SUM(
            CASE WHEN i.status IN ('sent', 'paid', 'overdue', 'partially_paid') 
            THEN i.amount_cents 
            ELSE 0 END
          ), 0) as total_invoiced_cents,
          
          -- Total paid: use the total_paid_cents column maintained by triggers
          COALESCE(SUM(
            CASE WHEN i.status IN ('sent', 'paid', 'overdue', 'partially_paid')
            THEN COALESCE(i.total_paid_cents, 0)
            ELSE 0 END
          ), 0) as total_paid_cents,
          
          -- Balance due: use the remaining_balance_cents column maintained by triggers  
          COALESCE(SUM(
            CASE WHEN i.status IN ('sent', 'overdue', 'partially_paid')
            THEN COALESCE(i.remaining_balance_cents, i.amount_cents)
            ELSE 0 END
          ), 0) as balance_due_cents
        FROM clients c
        LEFT JOIN invoices i ON i.client_id = c.id
        GROUP BY c.id;
      `
    });

    if (viewError) {
      console.error('Failed to update view:', viewError);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to update client_financials view',
        details: viewError.message,
        fallback_instructions: 'You may need to run the SQL manually in Supabase SQL Editor'
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Successfully updated client_financials view for partial payments support'
    });
    
  } catch (error) {
    console.error('Failed to update client_financials view:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: `Failed to update view: ${message}` 
    }, { status: 500 });
  }
}