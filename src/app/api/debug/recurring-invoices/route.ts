import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const adminSupabase = supabaseAdmin();

    // Get all recurring invoices with their current dates
    const { data: recurringInvoices, error } = await adminSupabase
      .from('recurring_invoices')
      .select(`
        id,
        title,
        start_date,
        next_invoice_date,
        status,
        clients (
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recurring invoices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      debug: true,
      timestamp: new Date().toISOString(),
      count: recurringInvoices?.length || 0,
      invoices: recurringInvoices || []
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}