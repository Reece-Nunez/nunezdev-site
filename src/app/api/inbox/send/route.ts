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
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  lookupSmsConsentByPhone,
  decideComposerSmsAction,
} from '@/lib/smsConsent';
import { getS3Object } from '@/lib/s3';
import {
  findOrCreateConversation,
  recordMessage,
  buildReplyToAddress,
} from '@/lib/inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FROM_EMAIL = 'reece@nunezdev.com';

const MAX_ATTACHMENTS = 10;
// Resend caps total message size at ~40MB; stay well under after base64 (~33%
// overhead) by limiting raw attachment bytes to 20MB total.
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

interface AttachmentRef {
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

/**
 * Load attachment refs from S3 into Resend-ready base64 content, returning both
 * the Resend payload and the durable metadata to store on the message. Throws
 * on over-limit or a missing object so the send fails loudly rather than
 * silently dropping a file the operator thinks they attached.
 */
async function loadAttachments(refs: AttachmentRef[]): Promise<{
  resend: { filename: string; content: string; contentType: string }[];
  meta: AttachmentRef[];
}> {
  if (refs.length > MAX_ATTACHMENTS) {
    throw new Error(`too many attachments (max ${MAX_ATTACHMENTS})`);
  }
  const total = refs.reduce((sum, r) => sum + (r.size || 0), 0);
  if (total > MAX_ATTACHMENT_BYTES) {
    throw new Error('attachments exceed 20MB total');
  }

  const resend: { filename: string; content: string; contentType: string }[] = [];
  for (const ref of refs) {
    const obj = await getS3Object(ref.key);
    const bytes = await obj.Body!.transformToByteArray();
    resend.push({
      filename: ref.filename,
      content: Buffer.from(bytes).toString('base64'),
      contentType: ref.contentType,
    });
  }
  return { resend, meta: refs };
}

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
    attachments?: AttachmentRef[];
  };

  const channel = body.channel;
  const to = (body.to ?? '').trim();
  const text = (body.body ?? '').trim();
  const attachmentRefs = Array.isArray(body.attachments) ? body.attachments : [];

  if (channel !== 'email' && channel !== 'sms') {
    return NextResponse.json({ error: 'channel must be "email" or "sms"' }, { status: 400 });
  }
  // Body is required, EXCEPT an email that's carrying attachments (sending just
  // a screenshot with no text is legitimate). SMS always needs text.
  const allowEmptyBody = channel === 'email' && attachmentRefs.length > 0;
  if (!text && !allowEmptyBody) {
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

    // Pull attachments from S3 into base64 before sending. A failure here
    // (missing object, over-limit) aborts the send — better than emailing the
    // client a message that's silently missing the file they expect.
    let loaded;
    try {
      loaded = await loadAttachments(attachmentRefs);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'attachment load failed';
      return NextResponse.json({ error, conversationId: conv.id }, { status: 400 });
    }

    const result = await sendEmail({
      to,
      subject,
      text: text || ' ',
      html: textToHtml(text),
      from: `Reece Nunez <${FROM_EMAIL}>`,
      replyTo: buildReplyToAddress(conv.id),
      attachments: loaded.resend.length ? loaded.resend : undefined,
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
      attachments: loaded.meta,
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

  // ── Opt-out gate ──────────────────────────────────────────────────────
  // Consent gate removed (owner policy): the owner texts clients directly.
  // We still block anyone who replied STOP — honoring opt-out is mandatory.
  const supabase = supabaseAdmin();
  const { count: inboundCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conv.id)
    .eq('direction', 'inbound');
  const consent = await lookupSmsConsentByPhone(phone);
  const action = decideComposerSmsAction({
    consented: consent.consented,
    optedOut: consent.optedOut,
    hasInbound: (inboundCount ?? 0) > 0,
  });

  if (action === 'block') {
    return NextResponse.json(
      {
        error:
          'This contact opted out of texts (replied STOP). Reach them another way.',
        optedOut: true,
        conversationId: conv.id,
      },
      { status: 409 },
    );
  }

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
