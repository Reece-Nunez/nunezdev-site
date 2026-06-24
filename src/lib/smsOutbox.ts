/**
 * Outbound SMS that also mirrors into the dashboard inbox.
 *
 * The raw `sendSms()` in @/lib/sms just talks to Twilio — it doesn't know
 * about conversations. Most outbound texts (invoice links, opt-in requests,
 * welcome messages, payment reminders) were sent with it directly, so they
 * never showed up in the inbox thread; only messages composed from the inbox
 * itself did.
 *
 * `sendTrackedSms` wraps the send and records the outbound message against the
 * SMS conversation for that number (creating the thread if needed), so the
 * inbox is a complete two-way history of everything to/from our Twilio number.
 *
 * Inbox recording is BEST-EFFORT: a failure there is logged but never changes
 * the actual send result — texting the client matters more than the mirror.
 *
 * Server-only (pulls in the service-role Supabase client via inbox.ts). Never
 * import into a Client Component.
 */
import { sendSms, getSmsFromNumber, type SmsSendResult } from '@/lib/sms';
import { findOrCreateConversation, recordMessage } from '@/lib/inbox';

export async function sendTrackedSms(params: {
  to: string;
  body: string;
  /** Operator user id when a human triggered it; null for automated sends. */
  sentBy?: string | null;
}): Promise<SmsSendResult> {
  const result = await sendSms({ to: params.to, body: params.body });

  try {
    const conv = await findOrCreateConversation({
      channel: 'sms',
      contactPhone: params.to,
    });
    await recordMessage({
      conversationId: conv.id,
      direction: 'outbound',
      channel: 'sms',
      fromAddress: getSmsFromNumber() ?? 'unknown',
      toAddress: params.to,
      bodyText: params.body,
      provider: 'twilio',
      providerId: result.ok ? result.sid ?? null : null,
      status: result.ok ? 'sent' : 'failed',
      error: result.ok ? null : result.error ?? null,
      sentBy: params.sentBy ?? null,
    });
  } catch (err) {
    // Don't let an inbox hiccup mask a successful (or failed) send.
    console.warn('[smsOutbox] inbox mirror failed (send result unaffected):', err);
  }

  return result;
}
