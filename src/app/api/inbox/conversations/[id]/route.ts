/**
 * Single conversation + its messages (Phase 5). Owner-only.
 *
 * GET /api/inbox/conversations/[id]
 *   → { conversation, messages } ordered oldest-first.
 *
 * Opening a thread marks it read (unread=false) — reading IS the read event,
 * so we don't need a separate mark-read endpoint.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generatePresignedViewUrl } from '@/lib/s3';

interface StoredAttachment {
  key?: string; // absent for inbound attachments (not hosted in our S3 yet)
  filename: string;
  contentType: string;
  size: number;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Ctx) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = supabaseAdmin();

  const { data: convRow, error: convErr } = await supabase
    .from('conversations')
    .select(
      'id, channel, contact_name, contact_email, contact_phone, subject, ' +
      'status, unread, last_message_at, client_id, lead_id',
    )
    .eq('id', id)
    .maybeSingle();

  if (convErr) {
    return NextResponse.json({ error: convErr.message }, { status: 500 });
  }
  if (!convRow) {
    return NextResponse.json({ error: 'conversation not found' }, { status: 404 });
  }

  // Cast: this project has no generated DB types, so the select-string parser
  // infers a GenericStringError union. Narrow to the real row shape.
  const conversation = convRow as unknown as {
    id: string;
    channel: 'email' | 'sms';
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    subject: string | null;
    status: string;
    unread: boolean;
    last_message_at: string | null;
    client_id: string | null;
    lead_id: string | null;
  };

  const { data: messagesRaw, error: msgErr } = await supabase
    .from('messages')
    .select(
      'id, direction, channel, from_address, to_address, subject, ' +
      'body_text, status, error, attachments, created_at',
    )
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(500);

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // Mint a fresh presigned view URL for each stored attachment (private
  // bucket → no durable public URL). Best-effort per file so one bad key
  // doesn't blank the whole thread.
  const messages = await Promise.all(
    ((messagesRaw ?? []) as unknown as Array<{ attachments?: StoredAttachment[] }>).map(
      async (m) => {
        const atts = Array.isArray(m.attachments) ? m.attachments : [];
        const withUrls = await Promise.all(
          atts.map(async (a) => {
            // Inbound attachments have no S3 key — nothing to sign.
            if (!a.key) return { ...a, url: null };
            try {
              return { ...a, url: await generatePresignedViewUrl(a.key, 3600) };
            } catch {
              return { ...a, url: null };
            }
          }),
        );
        return { ...m, attachments: withUrls };
      },
    ),
  );

  // Mark read on open. Best-effort: a failure here shouldn't block reading.
  if (conversation.unread) {
    await supabase.from('conversations').update({ unread: false }).eq('id', id);
    conversation.unread = false;
  }

  return NextResponse.json({ conversation, messages: messages ?? [] });
}
