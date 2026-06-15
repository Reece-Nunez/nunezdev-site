/**
 * Compose-and-send for the dashboard inbox (Phase 2, outbound).
 *
 * Owner-only. Body:
 *   {
 *     channel: 'email' | 'sms',
 *     to: string,                 // recipient email or phone
 *     subject?: string,           // email only
 *     body: string,
 *     conversationId?: string,    // continue an existing thread; else a new one
 *   }
 *
 * Flow: resolve/create the conversation → send via Resend/Twilio → record the
 * outbound message (status reflects send result). The DB trigger updates the
 * conversation tail, so we never touch the conversation row after insert.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { sendEmail } from '@/lib/email';
import { sendSms, normalizePhoneE164, getSmsFromNumber } from '@/lib/sms';
import {
  findOrCreateConversation,
  recordMessage,
  buildReplyToAddress,
} from '@/lib/inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FROM_EMAIL = 'reece@nunezdev.com';

/** Minimal HTML rendering of a composed plaintext body — escape, then keep
 *  line breaks. Resend wants html or text; we send both. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;white-space:pre-wrap;">${escaped}</div>`;
}

export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    channel?: string;
    to?: string;
    subject?: string;
    body?: string;
    conversationId?: string;
  };

  const channel = body.channel;
  const to = (body.to ?? '').trim();
  const text = (body.body ?? '').trim();

  if (channel !== 'email' && channel !== 'sms') {
    return NextResponse.json({ error: 'channel must be "email" or "sms"' }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: 'message body is required' }, { status: 400 });
  }

  // ── Email ───────────────────────────────────────────────────────────────
  if (channel === 'email') {
    if (!EMAIL_RE.test(to)) {
      return NextResponse.json({ error: 'valid recipient email required' }, { status: 400 });
    }
    const subject = (body.subject ?? '').trim() || '(no subject)';

    const conv = body.conversationId
      ? { id: body.conversationId }
      : await findOrCreateConversation({ channel: 'email', contactEmail: to, subject });

    const result = await sendEmail({
      to,
      subject,
      text,
      html: textToHtml(text),
      from: `Reece Nunez <${FROM_EMAIL}>`,
      replyTo: buildReplyToAddress(conv.id),
    });

    const msg = await recordMessage({
      conversationId: conv.id,
      direction: 'outbound',
      channel: 'email',
      fromAddress: FROM_EMAIL,
      toAddress: to,
      subject,
      bodyText: text,
      bodyHtml: textToHtml(text),
      provider: 'resend',
      providerId: result.ok ? result.id : null,
      status: result.ok ? 'sent' : 'failed',
      error: result.ok ? null : result.error,
      sentBy: guard.user!.id,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, conversationId: conv.id }, { status: 502 });
    }
    return NextResponse.json({ ok: true, conversationId: conv.id, messageId: msg.id });
  }

  // ── SMS ─────────────────────────────────────────────────────────────────
  const phone = normalizePhoneE164(to);
  if (!phone) {
    return NextResponse.json({ error: 'valid US phone number required' }, { status: 400 });
  }

  const conv = body.conversationId
    ? { id: body.conversationId }
    : await findOrCreateConversation({ channel: 'sms', contactPhone: phone });

  const result = await sendSms({ to: phone, body: text });

  const msg = await recordMessage({
    conversationId: conv.id,
    direction: 'outbound',
    channel: 'sms',
    fromAddress: getSmsFromNumber() ?? 'unknown',
    toAddress: phone,
    bodyText: text,
    provider: 'twilio',
    providerId: result.ok ? result.sid : null,
    status: result.ok ? 'sent' : 'failed',
    error: result.ok ? null : result.error,
    sentBy: guard.user!.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, conversationId: conv.id }, { status: 502 });
  }
  return NextResponse.json({ ok: true, conversationId: conv.id, messageId: msg.id });
}
