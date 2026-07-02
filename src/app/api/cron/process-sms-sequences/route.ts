import { NextRequest, NextResponse } from 'next/server';
import { processDueSms } from '@/lib/leadSmsSequence';

export const runtime = 'nodejs';

/**
 * Sends due lead follow-up texts. Invoked by Vercel Cron (Authorization: Bearer
 * ${CRON_SECRET}). processDueSms enforces quiet hours itself, so it's safe to
 * schedule hourly — off-hours runs just no-op.
 */
async function run(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await processDueSms();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('Error processing SMS sequences:', error);
    return NextResponse.json({ error: 'Failed to process SMS sequences' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
