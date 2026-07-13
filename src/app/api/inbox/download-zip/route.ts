/**
 * Bundle selected inbox attachments into a single zip download. Owner-only.
 *
 * POST /api/inbox/download-zip
 *   { conversationId: string, keys: string[] }  → application/zip stream
 *
 * We only zip keys that actually appear on this conversation's messages. The
 * whole inbox is already owner-gated, but scoping to the conversation's own
 * attachments stops this endpoint from being used to pull an arbitrary object
 * out of the shared bucket by key.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getS3Object } from '@/lib/s3';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StoredAttachment {
  key?: string;
  filename: string;
  contentType: string;
  size: number;
}

export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    conversationId?: string;
    keys?: unknown;
  };
  const conversationId = body.conversationId;
  const requestedKeys = Array.isArray(body.keys)
    ? body.keys.filter((k): k is string => typeof k === 'string')
    : [];

  if (!conversationId || requestedKeys.length === 0) {
    return NextResponse.json(
      { error: 'conversationId and at least one key are required' },
      { status: 400 },
    );
  }

  // Build the allowlist of keys → filename from this conversation's messages.
  const supabase = supabaseAdmin();
  const { data: rows, error } = await supabase
    .from('messages')
    .select('attachments')
    .eq('conversation_id', conversationId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nameByKey = new Map<string, string>();
  for (const r of (rows ?? []) as unknown as Array<{ attachments?: StoredAttachment[] }>) {
    const atts = Array.isArray(r.attachments) ? r.attachments : [];
    for (const a of atts) {
      if (a.key) nameByKey.set(a.key, a.filename || a.key.split('/').pop() || 'file');
    }
  }

  const validKeys = requestedKeys.filter((k) => nameByKey.has(k));
  if (validKeys.length === 0) {
    return NextResponse.json(
      { error: 'none of the requested attachments belong to this conversation' },
      { status: 400 },
    );
  }

  const archive = archiver('zip', { zlib: { level: 6 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);
  // Surface an archiver error onto the stream so the client sees a truncated
  // download rather than a silent hang.
  archive.on('error', (err) => passthrough.destroy(err));

  // De-dupe names so two "image-1.jpg" from different messages don't collide.
  const usedNames = new Map<string, number>();
  const uniqueName = (name: string): string => {
    const seen = usedNames.get(name) ?? 0;
    usedNames.set(name, seen + 1);
    if (seen === 0) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0
      ? `${name.slice(0, dot)} (${seen})${name.slice(dot)}`
      : `${name} (${seen})`;
  };

  for (const key of validKeys) {
    try {
      const obj = await getS3Object(key);
      if (obj.Body) {
        archive.append(obj.Body as Readable, { name: uniqueName(nameByKey.get(key)!) });
      }
    } catch (err) {
      console.error('[inbox/download-zip] fetch failed', key, err);
    }
  }
  archive.finalize();

  const webStream = new ReadableStream({
    start(controller) {
      passthrough.on('data', (chunk) => controller.enqueue(chunk));
      passthrough.on('end', () => controller.close());
      passthrough.on('error', (err) => controller.error(err));
    },
  });

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="inbox-images.zip"',
    },
  });
}
