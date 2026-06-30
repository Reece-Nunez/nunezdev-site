/**
 * SMS reminder policy enforcer.
 *
 * Every call site that wants to text a client about an invoice MUST go
 * through this file. The plain `sendSms()` in @/lib/sms is the raw send
 * primitive — it has no opinion about consent or quiet hours. This
 * module wraps it with all the rules we promised Twilio and the carriers:
 *
 *   1. Client must have phone + sms_opted_out_at=null (not opted out).
 *      Affirmative consent is no longer required (owner policy) — but STOP
 *      opt-out is still honored, here and at the carrier level.
 *   2. Org-level sms_enabled for the notification_type must be true
 *   3. Send only during quiet-hour-safe windows (9am–8pm Central, Mon–Sat)
 *   4. No duplicate sends for the same (invoice_id, reminder_type) in
 *      the same calendar day — protects against cron retries and the
 *      operator clicking "send" twice
 *   5. Every send (and skip) is logged to client_activity_log for audit
 *
 * The function never throws — it returns a structured result the caller
 * can summarize. Skipping is normal and expected; the cron should treat
 * "skipped: opted_out" the same as "sent ok" for control flow.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhoneE164 } from '@/lib/sms';
import { sendTrackedSms } from '@/lib/smsOutbox';

/** Reminder cadence types we support. Currently only due-today. */
export type InvoiceReminderType = 'payment_due' | 'payment_overdue';

export interface InvoiceReminderInput {
  invoiceId: string;
  clientId: string;
  /** notification_type — must exist in notification_preferences. */
  reminderType: InvoiceReminderType;
  /** Body of the SMS. Caller is responsible for keeping it concise and
   *  including STOP/HELP. We append nothing — what you pass is what sends. */
  body: string;
}

export interface InvoiceReminderResult {
  ok: boolean;
  sid?: string;
  /** When ok=false, why we skipped or failed. Stable strings so the
   *  caller can tally summaries. */
  reason?:
    | 'no_consent'
    | 'opted_out'
    | 'no_phone'
    | 'invalid_phone'
    | 'org_sms_disabled'
    | 'quiet_hours'
    | 'already_sent_today'
    | 'twilio_error'
    | 'db_error'
    | 'client_not_found';
  /** Free-form detail safe to log (no PII beyond what's already in client_activity_log). */
  detail?: string;
}

/**
 * Quiet hours guard. We're a US business serving mostly Central Time
 * clients; until we have per-client timezone we clamp on Central. The
 * window 9am–8pm CT, Mon–Sat is conservative and TCPA-safe everywhere
 * in the US (TCPA's actual ceiling is 8am–9pm in the *recipient's* tz).
 */
export function isQuietHoursOk(now: Date = new Date()): boolean {
  // toLocaleString is the simplest TZ-aware path that doesn't pull in
  // a date lib. Intl is built into Node and the format is stable.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hourStr = parts.find(p => p.type === 'hour')?.value;
  // Intl returns "24" for midnight on some Node versions. Normalize.
  const hour = hourStr === '24' ? 0 : Number(hourStr);

  if (weekday === 'Sun') return false;
  // Inclusive 9, exclusive 20 — i.e. last send at 7:59:59 PM CT.
  return hour >= 9 && hour < 20;
}

/**
 * Idempotency check: have we already sent THIS reminder type for THIS
 * invoice today? client_activity_log holds the source of truth.
 *
 * activity_type used: 'invoice_sms_sent'
 * activity_data.reminder_type: 'payment_due' | 'payment_overdue'
 */
async function wasSentToday(
  invoiceId: string,
  reminderType: InvoiceReminderType,
): Promise<boolean> {
  const supabase = supabaseAdmin();
  // Use UTC midnight as the day boundary — Twilio and Supabase both
  // store TZ-aware timestamps; comparing against UTC midnight keeps the
  // check deterministic regardless of where the cron runs.
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('client_activity_log')
    .select('id')
    .eq('invoice_id', invoiceId)
    .eq('activity_type', 'invoice_sms_sent')
    .gte('created_at', startOfDayUtc.toISOString())
    .contains('activity_data', { reminder_type: reminderType })
    .limit(1);

  if (error) {
    // Fail open on the dedupe check — better to risk a rare double-send
    // than to skip a legitimate one. We log so we notice if this misfires.
    console.warn('[smsReminders] dedupe check error, proceeding:', error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * The chokepoint. Performs every check, sends, logs the outcome.
 */
export async function sendInvoiceReminderSms(
  input: InvoiceReminderInput,
): Promise<InvoiceReminderResult> {
  const supabase = supabaseAdmin();

  // 1. Load the client with consent fields. Single query so we don't
  //    do N+1 lookups in the cron's loop.
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, org_id, name, phone, sms_consent, sms_opted_out_at')
    .eq('id', input.clientId)
    .single();

  if (clientErr || !client) {
    await logSkip(input, 'client_not_found', clientErr?.message);
    return { ok: false, reason: 'client_not_found', detail: clientErr?.message };
  }

  // Consent gate removed (owner policy) — reminders go to clients directly.
  // Opt-out (STOP), quiet hours, org toggle, and dedupe below still apply.
  if (client.sms_opted_out_at) {
    await logSkip(input, 'opted_out', client.sms_opted_out_at);
    return { ok: false, reason: 'opted_out' };
  }
  if (!client.phone) {
    await logSkip(input, 'no_phone');
    return { ok: false, reason: 'no_phone' };
  }
  const e164 = normalizePhoneE164(client.phone);
  if (!e164) {
    await logSkip(input, 'invalid_phone', client.phone);
    return { ok: false, reason: 'invalid_phone', detail: client.phone };
  }

  // 2. Per-org SMS toggle for this reminder type.
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('sms_enabled')
    .eq('org_id', client.org_id)
    .eq('notification_type', input.reminderType)
    .maybeSingle();
  if (!prefs?.sms_enabled) {
    await logSkip(input, 'org_sms_disabled');
    return { ok: false, reason: 'org_sms_disabled' };
  }

  // 3. Quiet hours.
  if (!isQuietHoursOk()) {
    await logSkip(input, 'quiet_hours');
    return { ok: false, reason: 'quiet_hours' };
  }

  // 4. Idempotency.
  if (await wasSentToday(input.invoiceId, input.reminderType)) {
    return { ok: false, reason: 'already_sent_today' };
  }

  // 5. Send. sendTrackedSms also mirrors the reminder into the inbox thread.
  const result = await sendTrackedSms({ to: e164, body: input.body });
  if (!result.ok) {
    await logSkip(input, 'twilio_error', result.error);
    return { ok: false, reason: 'twilio_error', detail: result.error };
  }

  // 6. Audit log.
  const { error: logErr } = await supabase.from('client_activity_log').insert({
    invoice_id: input.invoiceId,
    client_id: client.id,
    activity_type: 'invoice_sms_sent',
    activity_data: {
      reminder_type: input.reminderType,
      twilio_sid: result.sid,
      to_phone_last4: e164.slice(-4),
      body_length: input.body.length,
    },
  });
  if (logErr) {
    // The SMS already went out; we can't take it back. Log loudly but
    // still report success to the caller.
    console.error('[smsReminders] sent but failed to log activity:', logErr);
  }

  return { ok: true, sid: result.sid };
}

async function logSkip(
  input: InvoiceReminderInput,
  reason: NonNullable<InvoiceReminderResult['reason']>,
  detail?: string,
): Promise<void> {
  const supabase = supabaseAdmin();
  // We log skips so the dashboard can show "tried to remind, couldn't
  // because no consent" instead of going silent. activity_type kept
  // separate from 'invoice_sms_sent' so the dedupe query doesn't pick
  // up skips and falsely conclude we already sent.
  await supabase.from('client_activity_log').insert({
    invoice_id: input.invoiceId,
    client_id: input.clientId,
    activity_type: 'invoice_sms_skipped',
    activity_data: {
      reminder_type: input.reminderType,
      reason,
      ...(detail ? { detail } : {}),
    },
  }).then(({ error }) => {
    if (error) console.warn('[smsReminders] failed to log skip:', error.message);
  });
}
