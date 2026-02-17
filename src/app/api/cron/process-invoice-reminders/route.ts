import { NextRequest, NextResponse } from 'next/server';
import { invoiceReminderService } from '@/lib/invoiceReminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Check for CRON_SECRET authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting automated invoice reminder processing...');

    // Process upcoming invoice reminders
    await invoiceReminderService.processUpcomingInvoiceReminders();

    return NextResponse.json({
      success: true,
      message: 'Invoice reminders processed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error processing invoice reminders:', error);
    return NextResponse.json({
      error: 'Failed to process invoice reminders',
      details: error.message
    }, { status: 500 });
  }
}

// For manual testing
export async function GET() {
  return NextResponse.json({
    message: 'Invoice reminders cron endpoint',
    usage: 'POST with CRON_SECRET authorization',
    timestamp: new Date().toISOString()
  });
}