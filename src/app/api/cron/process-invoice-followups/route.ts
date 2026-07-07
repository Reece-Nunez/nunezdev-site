import { NextRequest, NextResponse } from 'next/server';
import { invoiceFollowupService } from '@/lib/invoiceFollowup';
import { processOverdueDunningSms } from '@/lib/invoiceDunningSms';

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
    // SMS dunning ladder runs alongside the email ladder. Isolated so a Twilio
    // hiccup can't fail the (already-completed) email run.
    const sms = await processOverdueDunningSms().catch((err) => {
      console.error('Error processing SMS dunning:', err);
      return { candidates: 0, byStatus: { error: 1 } };
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice follow-ups processed successfully',
      sms,
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
    const sms = await processOverdueDunningSms().catch((err) => {
      console.error('Error processing SMS dunning:', err);
      return { candidates: 0, byStatus: { error: 1 } };
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice follow-ups processed successfully',
      sms,
    });

  } catch (error: any) {
    console.error('Error processing invoice follow-ups:', error);
    return NextResponse.json(
      { error: 'Failed to process invoice follow-ups' },
      { status: 500 }
    );
  }
}