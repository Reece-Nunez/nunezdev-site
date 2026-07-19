/**
 * Owner SMS alert for new Thumbtack leads.
 *
 * Thumbtack has no native instant-reply feature, so the only lever on response
 * time is how fast the owner *learns* about the lead. The webhook already lands
 * leads in real time; this texts them straight to the owner's phone so a reply
 * can go out in seconds instead of whenever the dashboard is next opened.
 *
 * Env:
 *   THUMBTACK_ALERT_PHONE   Owner's mobile, any US format. Unset -> alerts off
 *                           (deliberately silent: the webhook must keep working
 *                           on a deploy where this hasn't been configured yet).
 *
 * Note this is an owner-to-self notification, not marketing to a lead, so the
 * A2P 10DLC consent flag that gates sendSMSNotification does not apply here.
 */
import { sendSms } from '@/lib/sms';
import type { ThumbtackLeadDetails } from '@/lib/thumbtackWebhook';

/** Cap the free-text quote so one lead can't turn into a 6-segment text. */
const DESCRIPTION_LIMIT = 90;

function truncate(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean;
}

/**
 * Render the alert body. Pure so the formatting is unit-tested without Twilio.
 *
 * Every field is optional in practice — Thumbtack payloads vary by category and
 * a message-first lead can arrive with almost nothing — so each line is dropped
 * rather than rendered empty. The result stays within ~2 SMS segments.
 */
export function buildLeadAlertSms(
  details: ThumbtackLeadDetails,
  baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com',
): string {
  const lines: string[] = [`New Thumbtack lead: ${details.customerName ?? 'Unknown'}`];

  // Category / budget / timeline read as one scannable line when present.
  const facts = [details.category, details.budget, details.timeline].filter(Boolean);
  if (facts.length > 0) lines.push(facts.join(' · '));

  if (details.description) lines.push(`"${truncate(details.description, DESCRIPTION_LIMIT)}"`);
  if (details.customerPhone) lines.push(details.customerPhone);

  lines.push(`${baseUrl}/dashboard/leads`);
  return lines.join('\n');
}

/**
 * Text the owner about a new lead. Best-effort by design: a failed alert must
 * never fail the webhook, because the lead itself is already stored and losing
 * the event would be far worse than losing the notification.
 */
export async function sendNewLeadAlert(details: ThumbtackLeadDetails): Promise<void> {
  const to = process.env.THUMBTACK_ALERT_PHONE?.trim();
  if (!to) return;

  const result = await sendSms({ to, body: buildLeadAlertSms(details) });
  if (!result.ok) {
    console.error('[thumbtack] new-lead alert failed:', result.error);
  }
}
