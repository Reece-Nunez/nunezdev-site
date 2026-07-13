/**
 * SMS follow-up cadence for phone-only leads (Thumbtack) — the SMS twin of the
 * email nurture sequence (leadNurturing.ts). Thumbtack leads have a phone but
 * no email, so email sequences can't reach them; this schedules a persistent
 * multi-day text cadence into `scheduled_sms`, sent by the process-sms-sequences
 * cron. Auto-stops the moment the lead replies, opts out (STOP), or is marked
 * won/lost.
 *
 * The pure helpers (renderSmsTemplate, buildSequenceRows, isStopStatus) are
 * unit-tested; the DB/Twilio glue lives in the async functions below.
 */
import { supabaseAdmin } from './supabaseAdmin';
import { sendTrackedSms } from './smsOutbox';
import { isQuietHoursOk } from './smsReminders';
import { normalizePhoneE164 } from './sms';

// Configurable links. /book is the self-hosted scheduler (pick a time on the
// calendar) — it converts better than dropping the lead back on a form.
const BOOKING_URL = 'https://www.nunezdev.com/book';
const PORTFOLIO_URL = 'https://www.nunezdev.com/portfolio';

export interface SmsSequenceStep {
  step: number;
  delayDays: number;
  body: string;
}

// The cadence. Persistence is the point: most leads reply on touch 3–5, and
// competitors quit after 1–2. Step 0 carries the STOP notice (once is enough).
export const THUMBTACK_SMS_SEQUENCE: SmsSequenceStep[] = [
  {
    step: 0,
    delayDays: 0,
    body:
      "Hey {name}, this is Reece with NunezDev, saw your {service} request. I put together a quick idea of what I'd build you, want me to send it over? Or grab a time here: {booking}. (Reply STOP to opt out.)",
  },
  {
    step: 1,
    delayDays: 1,
    body:
      "Following up on your {service} project, {name}. Happy to just text through any questions if that's easier than a call. What are you hoping to get done?",
  },
  {
    step: 2,
    delayDays: 3,
    body:
      "Hi {name}, still glad to help with your {service}. Here's some recent work: {portfolio}. Want me to put together a rough scope and price?",
  },
  {
    step: 3,
    delayDays: 7,
    body:
      "{name}, checking in once more on your {service}. If now's not the time, no worries. If it is, grab a spot here: {booking}",
  },
  {
    step: 4,
    delayDays: 14,
    body:
      "Hey {name}, I'll close out your file so I'm not bugging you. Anytime you want to pick the {service} back up, just text me here. Reece",
  },
];

/** Lead statuses that mean "stop following up". */
const STOP_STATUSES = new Set(['converted', 'qualified', 'lost']);
export function isStopStatus(status: string | null | undefined): boolean {
  return !!status && STOP_STATUSES.has(status);
}

/**
 * Call-site gate for AUTO-enrollment (owner-triggered manual enrollment via the
 * dashboard is not subject to this — it's the one place we allow overriding).
 * Offshore-quarantined leads must never be cold-texted: it's junk/geo-screened
 * traffic and a compliance liability. We centralize the rule here (instead of an
 * implicit `if` at each caller) so it's covered by one unit test and can't drift.
 * Returns the skip reason, or null if the lead is eligible to auto-enroll.
 *
 * Note: this is only the pre-DB gate. `enrollLeadInSmsSequence` still applies its
 * own guards (no phone / opted out / terminal status / already running).
 */
export function autoEnrollSkipReason(lead: {
  tags?: string[] | null;
  lowQuality?: boolean;
}): 'offshore' | null {
  if (lead.lowQuality) return 'offshore';
  if (lead.tags?.includes('offshore')) return 'offshore';
  return null;
}

/** Fill {name}/{service}/{booking}/{portfolio} in a step body. */
export function renderSmsTemplate(
  body: string,
  lead: { name?: string | null; project_type?: string | null },
): string {
  const firstName = (lead.name ?? '').trim().split(/\s+/)[0] || 'there';
  const service = (lead.project_type ?? '').trim().toLowerCase() || 'project';
  return body
    .split('{name}').join(firstName)
    .split('{service}').join(service)
    .split('{booking}').join(BOOKING_URL)
    .split('{portfolio}').join(PORTFOLIO_URL);
}

export interface ScheduledSmsRow {
  lead_id: string;
  step: number;
  body: string;
  scheduled_for: string;
  status: 'pending';
}

/** Pure: the rows to insert to enroll a lead, rendered + scheduled from nowMs. */
export function buildSequenceRows(
  leadId: string,
  lead: { name?: string | null; project_type?: string | null },
  nowMs: number,
): ScheduledSmsRow[] {
  return THUMBTACK_SMS_SEQUENCE.map((s) => ({
    lead_id: leadId,
    step: s.step,
    body: renderSmsTemplate(s.body, lead),
    scheduled_for: new Date(nowMs + s.delayDays * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending' as const,
  }));
}

type SupabaseAdmin = ReturnType<typeof supabaseAdmin>;

export interface EnrollResult {
  scheduled: number;
  reason?: 'no_phone' | 'opted_out' | 'terminal_status' | 'already_enrolled' | 'lead_not_found' | string;
}

/**
 * Enroll a lead into the SMS cadence (idempotent — a second call is a no-op).
 * Skips leads with no valid phone, opted out, or already in a terminal status.
 */
export async function enrollLeadInSmsSequence(leadId: string): Promise<EnrollResult> {
  const supabase = supabaseAdmin();
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, phone, project_type, status, sms_opted_out_at')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return { scheduled: 0, reason: 'lead_not_found' };
  if (!normalizePhoneE164(lead.phone ?? '')) return { scheduled: 0, reason: 'no_phone' };
  if (lead.sms_opted_out_at) return { scheduled: 0, reason: 'opted_out' };
  if (isStopStatus(lead.status)) return { scheduled: 0, reason: 'terminal_status' };

  // Block only if a cadence is currently RUNNING (pending steps). If a prior
  // cadence finished or was stopped, allow a restart (upsert resets each step).
  const { count } = await supabase
    .from('scheduled_sms')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('status', 'pending');
  if (count && count > 0) return { scheduled: 0, reason: 'already_enrolled' };

  const rows = buildSequenceRows(leadId, lead, Date.now());
  const { error } = await supabase
    .from('scheduled_sms')
    .upsert(rows, { onConflict: 'lead_id,step' });
  if (error) return { scheduled: 0, reason: error.message };
  return { scheduled: rows.length };
}

/**
 * Cancel pending follow-ups for whichever lead(s) own this phone number
 * (last-10-digit match). Called from the inbound-SMS webhook so the cadence
 * stops the instant a lead replies — no more robo-texting someone who answered.
 */
export async function cancelSequencesForPhone(phone: string, reason = 'lead_replied'): Promise<number> {
  const supabase = supabaseAdmin();
  const key = (phone || '').replace(/\D/g, '').slice(-10);
  if (key.length < 10) return 0;
  const { data: leads } = await supabase.from('leads').select('id, phone');
  const leadIds = ((leads ?? []) as { id: string; phone: string | null }[])
    .filter((l) => (l.phone ?? '').replace(/\D/g, '').slice(-10) === key)
    .map((l) => l.id);
  let total = 0;
  for (const id of leadIds) total += await cancelLeadSmsSequence(id, reason);
  return total;
}

/** Cancel a lead's remaining (pending) follow-ups. Returns how many were cancelled. */
export async function cancelLeadSmsSequence(leadId: string, reason: string): Promise<number> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('scheduled_sms')
    .update({ status: 'canceled', error_message: reason })
    .eq('lead_id', leadId)
    .eq('status', 'pending')
    .select('id');
  return (data ?? []).length;
}

async function markSms(
  supabase: SupabaseAdmin,
  id: string,
  status: 'sent' | 'failed',
  error: string | null,
  sid?: string,
): Promise<void> {
  await supabase
    .from('scheduled_sms')
    .update({
      status,
      error_message: error,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      twilio_sid: sid ?? null,
    })
    .eq('id', id);
}

export interface ProcessSummary {
  processed: number;
  byStatus: Record<string, number>;
}

/**
 * Send all due follow-ups. Called by the cron. Enforces quiet hours (nothing
 * outside 9am–8pm Central), skips messages more than 3 days stale, and re-checks
 * each lead's stop conditions (opted out / won / lost) right before sending.
 */
export async function processDueSms(limit = 25): Promise<ProcessSummary> {
  const byStatus: Record<string, number> = {};
  const bump = (k: string) => (byStatus[k] = (byStatus[k] ?? 0) + 1);

  if (!isQuietHoursOk()) return { processed: 0, byStatus: { skipped_quiet_hours: 1 } };

  const supabase = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: due } = await supabase
    .from('scheduled_sms')
    .select('id, lead_id, body, scheduled_for, leads!inner(id, phone, status, sms_opted_out_at)')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  for (const row of (due ?? []) as unknown as {
    id: string;
    lead_id: string;
    body: string;
    scheduled_for: string;
    leads: { phone: string | null; status: string | null; sms_opted_out_at: string | null }
      | { phone: string | null; status: string | null; sms_opted_out_at: string | null }[];
  }[]) {
    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;

    if (row.scheduled_for < staleCutoff) {
      await markSms(supabase, row.id, 'failed', 'skipped: scheduled too far in the past');
      bump('skipped_stale');
      continue;
    }
    if (lead?.sms_opted_out_at) {
      await cancelLeadSmsSequence(row.lead_id, 'opted_out');
      bump('canceled_opted_out');
      continue;
    }
    if (isStopStatus(lead?.status)) {
      await cancelLeadSmsSequence(row.lead_id, 'terminal_status');
      bump('canceled_status');
      continue;
    }
    const phone = normalizePhoneE164(lead?.phone ?? '');
    if (!phone) {
      await markSms(supabase, row.id, 'failed', 'no valid phone');
      bump('no_phone');
      continue;
    }

    const res = await sendTrackedSms({ to: phone, body: row.body, sentBy: null });
    if (res.ok) {
      await markSms(supabase, row.id, 'sent', null, res.sid);
      await supabase.from('leads').update({ last_contact: nowIso }).eq('id', row.lead_id);
      bump('sent');
    } else {
      await markSms(supabase, row.id, 'failed', res.error ?? 'send failed');
      bump('failed');
    }
  }

  return { processed: (due ?? []).length, byStatus };
}
