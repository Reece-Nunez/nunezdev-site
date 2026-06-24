/**
 * Inbox conversation list (Phase 5). Owner-only.
 *
 * GET /api/inbox/conversations?status=open
 *   → { conversations: [...] } ordered most-recently-active first.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildContactNameMaps, resolveDisplayName } from '@/lib/inboxContacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const status = new URL(req.url).searchParams.get('status') ?? 'open';
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'id, channel, contact_name, contact_email, contact_phone, subject, ' +
      'status, unread, last_message_at, last_message_preview, last_direction',
    )
    .eq('status', status)
    // nullsFirst:false keeps brand-new (no-message) threads off the top.
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Cross-reference each thread's phone/email against the client + lead lists
  // so a known contact shows as their name, not a bare number — even if the
  // match didn't exist when the conversation was first created. Falls back to
  // the stored contact_name, then phone/email, in the UI.
  type ConvRow = {
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  };
  const conversations = (data ?? []) as unknown as ConvRow[];
  const maps = await buildContactNameMaps();
  const enriched = conversations.map((c) => ({
    ...c,
    contact_name: resolveDisplayName(maps, c) ?? c.contact_name,
  }));

  return NextResponse.json({ conversations: enriched });
}
