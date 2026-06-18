import { NextRequest, NextResponse } from 'next/server';
import { processRecurringInvoices } from '@/lib/recurringInvoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run the processor in-process. Previously this route did an HTTP
    // self-fetch to /api/recurring-invoices/process, but that secondary
    // request was intercepted by Vercel Deployment Protection (the SSO wall)
    // and never reached the processor — silently breaking the nightly cron.
    const { status, body } = await processRecurringInvoices();

    if (status >= 400) {
      console.error('Failed to process recurring invoices:', JSON.stringify(body));
      return NextResponse.json(body, { status });
    }

    console.log(`Automated recurring invoice processing completed: ${body.processed} invoices processed`);

    return NextResponse.json({
      success: true,
      message: `Processed ${body.processed} recurring invoices`,
      timestamp: new Date().toISOString(),
      ...body,
    });
  } catch (error) {
    console.error('Error in automated recurring invoice processing:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
