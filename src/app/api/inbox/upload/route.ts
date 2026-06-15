/**
 * Presigned-upload endpoint for inbox attachments (email only). Owner-only.
 *
 * POST /api/inbox/upload
 *   Body: { filename: string, contentType: string }
 *   → { key, uploadUrl }  — browser PUTs the file straight to S3 (keeps the
 *      bytes off the Vercel function, dodging its request-body size limit).
 *
 * Type allowlist keeps this to things you'd actually email a client — images
 * and PDFs — and blocks executables/scripts from being parked in the bucket.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireOwner } from '@/lib/authz';
import { generatePresignedUploadUrl } from '@/lib/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    filename?: string;
    contentType?: string;
  };
  const filename = (body.filename ?? '').trim();
  const contentType = (body.contentType ?? '').trim();

  if (!filename) {
    return NextResponse.json({ error: 'filename required' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `unsupported type: ${contentType || 'unknown'}` },
      { status: 400 },
    );
  }

  // Sanitize the filename for the key; a UUID prefix guarantees uniqueness so
  // two "screenshot.png" uploads never collide.
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 120);
  const key = `inbox-attachments/${randomUUID()}_${safeName}`;

  const uploadUrl = await generatePresignedUploadUrl({ key, contentType, expiresIn: 600 });
  return NextResponse.json({ key, uploadUrl });
}
