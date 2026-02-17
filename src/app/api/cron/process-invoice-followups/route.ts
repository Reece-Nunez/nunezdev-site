import { NextRequest, NextResponse } from 'next/server';
import { invoiceFollowupService } from '@/lib/invoiceFollowup';

export async function POST(request: NextRequest) {
  try {
    // Verify this is coming from a cron job or authorized source
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

// Allow GET for testing
export async function GET(request: NextRequest) {
  try {
    console.log('Test processing invoice follow-ups...');

    await invoiceFollowupService.processOverdueInvoices();

    return NextResponse.json({
      success: true,
      message: 'Test run completed - invoice follow-ups processed'
    });

  } catch (error: any) {
    console.error('Error in test run:', error);
    return NextResponse.json(
      { error: 'Test run failed' },
      { status: 500 }
    );
  }
}