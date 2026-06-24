/**
 * Inbox unread count — powers the sidebar badge. Owner-only.
 *
 * GET /api/inbox/unread-count → { count }
 *   count = open conversations with at least one unread (inbound) message.
 *   The `unread` flag is maintained by the bump_conversation_on_message
 *   trigger (true on inbound, false on outbound) and cleared when the
 *   operator opens the thread.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
    .eq('unread', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { count: count ?? 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
