/**
 * Resend inbound-email webhook (Phase 4). Receives client replies and threads
 * them into the inbox.
 *
 * Mail to <conversation_id>@reply.nunezdev.com (our outbound Reply-To) lands
 * here via Resend Inbound. We:
 *   1. Verify the Svix signature (RESEND_WEBHOOK_SECRET).
 *   2. On email.received, find the conversation — by the id embedded in the
 *      recipient address, else by the sender's email (so a reply to a plain
 *      reply@ address, or a fresh email, still threads).
 *   3. Retrieve the body (webhook is metadata-only) and record an inbound
 *      message, idempotent on Resend's email_id.
 *
 * Returns 401 on a bad signature (no retry), 500 on a processing error (so
 * Resend retries — the email_id idempotency makes retries safe), 200 otherwise.
 */
import { NextResponse } from 'next/server';
import { verifyResendWebhook } from '@/lib/resendWebhook';
import { getReceivedEmail } from '@/lib/email';
import {
  findOrCreateConversation,
  recordMessage,
  parseConversationIdFromAddress,
} from '@/lib/inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InboundPayload {
  type: string;
  data: {
    email_id: string;
    from: string;
    to?: string[];
    subject?: string | null;
    attachments?: { filename: string; content_type?: string; size?: number }[];
  };
}

/** Pull a bare email address out of an optional "Name <addr>" wrapper. */
function bareAddress(input: string): string {
  const m = input.match(/<([^>]+)>/);
  return (m ? m[1] : input).trim().toLowerCase();
}

export async function POST(req: Request) {
  // Raw body string is required — signature is computed over exact bytes.
  const payload = await req.text();

  const verdict = verifyResendWebhook({
    payload,
    headers: {
      id: req.headers.get('svix-id') ?? '',
      timestamp: req.headers.get('svix-timestamp') ?? '',
      signature: req.headers.get('svix-signature') ?? '',
    },
    secret: process.env.RESEND_WEBHOOK_SECRET ?? '',
  });
  if (!verdict.ok) {
    console.warn('[resend-inbound] signature check failed:', verdict.reason);
    return new NextResponse('Forbidden', { status: 401 });
  }

  let event: InboundPayload;
  try {
    event = JSON.parse(payload) as InboundPayload;
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // Ignore any non-inbound events that might share this endpoint.
  if (event.type !== 'email.received') {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  try {
    const data = event.data;
    const from = bareAddress(data.from);
    const toList = data.to ?? [];

    // Prefer the conversation id embedded in a recipient (our Reply-To);
    // fall back to threading by the sender's email.
    let conversationId: string | null = null;
    for (const addr of toList) {
      const id = parseConversationIdFromAddress(addr);
      if (id) {
        conversationId = id;
        break;
      }
    }
    if (!conversationId) {
      const conv = await findOrCreateConversation({
        channel: 'email',
        contactEmail: from,
        subject: data.subject ?? null,
      });
      conversationId = conv.id;
    }

    // Body is metadata-only in the webhook — fetch the full email.
    const full = await getReceivedEmail(data.email_id);

    const attachments = (data.attachments ?? full?.attachments ?? []).map((a) => ({
      filename: a.filename,
      contentType: a.content_type ?? 'application/octet-stream',
      size: a.size ?? 0,
    }));

    await recordMessage({
      conversationId,
      direction: 'inbound',
      channel: 'email',
      fromAddress: from,
      toAddress: bareAddress(toList[0] ?? ''),
      subject: data.subject ?? full?.subject ?? null,
      bodyText: full?.text ?? null,
      bodyHtml: full?.html ?? null,
      provider: 'resend',
      providerId: data.email_id,
      status: 'received',
      attachments,
    });

    return NextResponse.json({ ok: true, conversationId });
  } catch (err) {
    // 500 → Resend retries; recordMessage is idempotent on email_id so a
    // retry can't double-post.
    console.error('[resend-inbound] processing failed:', err);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
