import { NextRequest, NextResponse } from 'next/server';
import { leadNurtureService } from '@/lib/leadNurturing';

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

    console.log('Processing scheduled emails...');

    await leadNurtureService.processScheduledEmails();

    return NextResponse.json({
      success: true,
      message: 'Email sequences processed successfully'
    });

  } catch (error) {
    console.error('Error processing email sequences:', error);
    return NextResponse.json(
      { error: 'Failed to process email sequences' },
      { status: 500 }
    );
  }
}

// Allow GET for testing
export async function GET(request: NextRequest) {
  try {
    console.log('Test processing scheduled emails...');

    await leadNurtureService.processScheduledEmails();

    return NextResponse.json({
      success: true,
      message: 'Test run completed - email sequences processed'
    });

  } catch (error) {
    console.error('Error in test run:', error);
    return NextResponse.json(
      { error: 'Test run failed' },
      { status: 500 }
    );
  }
}