/**
 * Instant new-lead auto-reply over Thumbtack messaging.
 *
 * Goal: 0 reply time — the moment a NegotiationCreatedV4 lands, send a first
 * message so NunezDev is the first pro to respond. Wired into
 * thumbtackProcessor on FIRST lead capture (best-effort), behind the
 * THUMBTACK_AUTO_REPLY flag.
 *
 * Content: an AI draft in Reece's voice (reusing the /leads/draft-reply prompt),
 * with a templated fallback if the AI is slow/unavailable so a reply ALWAYS
 * goes out fast. Every draft is passed through stripContactInfo() before
 * sending — Thumbtack prohibits sharing off-platform contact info (phone /
 * email / links) in messages, and an unattended send must never risk that.
 *
 * Server-only (Anthropic + Supabase service role). Not for the CLI/client.
 */
import { getAnthropicClient, AI_MODEL, MissingAnthropicKeyError } from '@/lib/ai/anthropic';
import { recordedCreate } from '@/lib/ai/llmMetrics';
import {
  THUMBTACK_REPLY_SYSTEM_PROMPT,
  buildReplyUserPrompt,
  sanitizeReply,
} from '@/lib/ai/thumbtackReply';
import { extractLeadDetails } from '@/lib/thumbtackWebhook';
import { sendThumbtackMessage } from '@/lib/thumbtackApi';
import { recordOutboundThumbtackMessage } from '@/lib/thumbtackInbox';

export type AutoReplyStatus = 'disabled' | 'sent' | 'skipped_no_negotiation' | 'error';

export interface AutoReplyResult {
  status: AutoReplyStatus;
  usedFallback?: boolean;
  detail?: string;
}

// Cap the AI draft so a slow model can't stall the webhook past Thumbtack's
// delivery timeout — we fall back to the template and still reply instantly.
const AI_DRAFT_TIMEOUT_MS = 7000;

/** True when the instant auto-reply is switched on for this deploy. */
export function autoReplyEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.THUMBTACK_AUTO_REPLY === 'true';
}

/**
 * Remove anything that reads as off-platform contact info — phone numbers,
 * emails, and URLs — plus a stray "call/text me at" lead-in. Belt-and-suspenders
 * over the AI prompt (which is told not to include them) and applied to the
 * template too. Pure + unit-tested.
 */
export function stripContactInfo(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '') // urls
    .replace(/\bwww\.\S+/gi, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/gi, '') // emails
    // phone-like runs: 7+ digits possibly with spaces / () / . / - / + between
    .replace(/\+?\d(?:[\d\s().-]{6,})\d/g, '')
    // dangling "call/text/reach me at" once its number was stripped
    .replace(/\b(?:call|text|reach|phone|email)(?:\s+me)?(?:\s+at)?[\s:.,-]*$/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

/** Deterministic fallback message when the AI draft is unavailable. */
export function buildTemplatedReply(params: {
  leadName?: string | null;
  projectType?: string | null;
}): string {
  const first = (params.leadName ?? '').trim().split(/\s+/)[0];
  const hi = first ? `Hi ${first}, ` : 'Hi, ';
  const about = params.projectType ? ` about ${params.projectType.trim()}` : '';
  return (
    `${hi}thanks for reaching out${about}. This is Reece with NunezDev and I would love to help. ` +
    `What is the best time for a quick call to talk through what you need?`
  );
}

async function draftWithAi(details: ReturnType<typeof extractLeadDetails>): Promise<string | null> {
  const client = getAnthropicClient(); // throws MissingAnthropicKeyError if unset
  const aiCall = recordedCreate(
    client,
    'thumbtack.auto_reply',
    {
      model: AI_MODEL,
      max_tokens: 600,
      system: THUMBTACK_REPLY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildReplyUserPrompt({
            leadName: details.customerName,
            projectType: details.category,
            theirMessage: details.description,
          }),
        },
      ],
    },
    { entityId: details.negotiationID ?? undefined }
  );

  // Bound the AI call so it can't stall the webhook; template fallback wins on timeout.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), AI_DRAFT_TIMEOUT_MS));
  const message = await Promise.race([aiCall, timeout]);
  if (!message) return null;

  const block = message.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text : null;
}

/**
 * Draft + send the instant first reply for a new lead. Best-effort: returns a
 * status rather than throwing on ordinary failures, so the webhook is never
 * failed by a reply problem (the lead is already captured).
 */
export async function sendInstantLeadReply(
  payload: unknown,
  opts: { orgId?: string } = {}
): Promise<AutoReplyResult> {
  if (!autoReplyEnabled()) return { status: 'disabled' };

  const details = extractLeadDetails(payload);
  if (!details.negotiationID) return { status: 'skipped_no_negotiation' };

  // Draft: AI first, template on any failure/timeout — a reply always goes out.
  let usedFallback = false;
  let draft: string | null = null;
  try {
    const aiText = await draftWithAi(details);
    draft = aiText ? sanitizeReply(aiText) : null;
    if (!draft) usedFallback = true;
  } catch (e) {
    // Missing key / rate limit / API error — fall back, don't fail the lead.
    if (!(e instanceof MissingAnthropicKeyError)) {
      console.error('[thumbtack] auto-reply AI draft failed, using template:', e);
    }
    usedFallback = true;
  }
  if (!draft) {
    draft = buildTemplatedReply({ leadName: details.customerName, projectType: details.category });
  }

  // Compliance: never send off-platform contact info in a Thumbtack message.
  const finalText = stripContactInfo(draft);
  if (!finalText) return { status: 'error', detail: 'empty message after sanitizing' };

  try {
    const sent = await sendThumbtackMessage(details.negotiationID, finalText, { orgId: opts.orgId });
    // Best-effort inbox record so Reece sees what auto-sent (idempotent on messageID).
    try {
      await recordOutboundThumbtackMessage({
        negotiationID: details.negotiationID,
        text: finalText,
        customerName: details.customerName,
        messageID: sent.messageID ?? null,
      });
    } catch (e) {
      console.error('[thumbtack] auto-reply sent but inbox record failed:', e);
    }
    return { status: 'sent', usedFallback };
  } catch (e) {
    return { status: 'error', usedFallback, detail: e instanceof Error ? e.message : String(e) };
  }
}
