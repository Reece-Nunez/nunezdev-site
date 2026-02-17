import { NextRequest, NextResponse } from 'next/server';
import { invoiceFollowupService } from '@/lib/invoiceFollowup';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, message } = await request.json();

    if (!invoiceId || !message) {
      return NextResponse.json(
        { error: 'Invoice ID and message are required' },
        { status: 400 }
      );
    }

    await invoiceFollowupService.sendManualFollowup(invoiceId, message);

    return NextResponse.json({
      success: true,
      message: 'Manual follow-up sent successfully'
    });

  } catch (error: any) {
    console.error('Error sending manual follow-up:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send follow-up' },
      { status: 500 }
    );
  }
}

// Get follow-up history for an invoice
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const { data: followups, error } = await supabase
      .from('invoice_followups')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('Error fetching follow-ups:', error);
      return NextResponse.json(
        { error: 'Failed to fetch follow-ups' },
        { status: 500 }
      );
    }

    return NextResponse.json({ followups });

  } catch (error: any) {
    console.error('Error fetching follow-ups:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}