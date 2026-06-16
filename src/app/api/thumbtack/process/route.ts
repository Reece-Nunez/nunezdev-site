/**
 * Backfill / retry endpoint for Thumbtack event processing.
 *
 * Processes all `thumbtack_events` rows where processed = false (lead -> expense,
 * message -> inbox). Use it to (a) process events that arrived before inline
 * processing existed, and (b) retry events that hit a transient skip (e.g. org
 * not yet resolvable). Owner-gated — this touches financial records.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { processUnprocessedThumbtackEvents } from '@/lib/thumbtackProcessor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const summary = await processUnprocessedThumbtackEvents();
  return NextResponse.json(summary);
}

// GET for a quick count of what's pending, without processing.
export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
  const { count } = await supabaseAdmin()
    .from('thumbtack_events')
    .select('id', { count: 'exact', head: true })
    .eq('processed', false);

  return NextResponse.json({ unprocessed: count ?? 0 });
}
