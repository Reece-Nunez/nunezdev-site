import { NextRequest, NextResponse } from 'next/server';
import { invoiceFollowupService } from '@/lib/invoiceFollowup';

export async function POST(request: NextRequest) {
  try {
    // Verify this is coming from a cron job or authorized source
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Processing invoice follow-ups...');

    await invoiceFollowupService.processOverdueInvoices();

    return NextResponse.json({
      success: true,
      message: 'Invoice follow-ups processed successfully'
    });

  } catch (error: any) {
    console.error('Error processing invoice follow-ups:', error);
    return NextResponse.json(
      { error: 'Failed to process invoice follow-ups' },
      { status: 500 }
    );
  }
}

// Vercel Cron invokes via GET and includes Authorization: Bearer ${CRON_SECRET}.
// Auth is required here too — without it, anyone hitting the URL could trigger a
// run (previously this GET was unauthenticated).
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await invoiceFollowupService.processOverdueInvoices();

    return NextResponse.json({
      success: true,
      message: 'Invoice follow-ups processed successfully'
    });

  } catch (error: any) {
    console.error('Error processing invoice follow-ups:', error);
    return NextResponse.json(
      { error: 'Failed to process invoice follow-ups' },
      { status: 500 }
    );
  }
}