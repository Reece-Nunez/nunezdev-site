import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = supabaseAdmin();

    // Get all recurring invoices where next_invoice_date is in the future but before start_date logic was wrong
    const { data: recurringInvoices, error: fetchError } = await adminSupabase
      .from('recurring_invoices')
      .select('*')
      .eq('status', 'active')
      .eq('total_invoices_sent', 0) // Haven't sent any invoices yet
      .gte('start_date', '2025-10-01'); // Start date is October 1st or later

    if (fetchError) {
      console.error('Error fetching recurring invoices:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const updates = [];

    for (const invoice of recurringInvoices || []) {
      // For invoices that haven't sent any invoices yet, set next_invoice_date to start_date
      const startDate = new Date(invoice.start_date);
      const today = new Date();

      // If start date is in the future, next invoice date should be start date
      if (startDate > today) {
        const { error: updateError } = await adminSupabase
          .from('recurring_invoices')
          .update({
            next_invoice_date: invoice.start_date, // Set next invoice to start date
            updated_at: new Date().toISOString()
          })
          .eq('id', invoice.id);

        if (updateError) {
          console.error(`Error updating invoice ${invoice.id}:`, updateError);
        } else {
          updates.push({
            id: invoice.id,
            title: invoice.title,
            old_next_date: invoice.next_invoice_date,
            new_next_date: invoice.start_date
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${updates.length} recurring invoice dates`,
      updates
    });

  } catch (error: any) {
    console.error('Error fixing recurring invoice dates:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}