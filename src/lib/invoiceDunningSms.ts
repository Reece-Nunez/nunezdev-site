/**
 * Overdue-invoice SMS dunning ladder (Phase 2 of the SMS follow-up work).
 *
 * The SMS twin of the email overdue ladder (invoiceFollowup.ts). Where email
 * escalates at 1/7/14/30 days, SMS runs a slightly-delayed 3/10/21 cadence so a
 * text is never the client's first contact about a late invoice. Sends go
 * through sendInvoiceReminderSms (smsReminders.ts), which owns all the policy:
 * STOP opt-out, quiet hours, the per-org SMS toggle, and per-day dedupe.
 *
 * The 35-day "your site could be shut down" rung is deliberately NOT here — it
 * requires owner approval and lands in Phase 3 (dashboard approval queue). This
 * module only auto-sends the gentle/firm/urgent rungs.
 *
 * Dedupe is once-per-(invoice,tier)-ever via the invoice_dunning_sms table. The
 * pure helpers (selectDunningTier, renderDunningBody) are unit-tested; the DB glue
 * lives in processOverdueDunningSms.
 */
import { supabaseAdmin } from './supabaseAdmin';
import { sendInvoiceReminderSms, type InvoiceReminderResult } from './smsReminders';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';

export type DunningTier = 'gentle' | 'firm' | 'urgent';

export interface DunningContext {
  firstName: string;
  invoiceNumber: string;
  amount: string; // pre-formatted, e.g. "$1,234.00"
  daysOverdue: number;
  payUrl: string; // '' when the invoice has no public link
}

export interface DunningStep {
  tier: DunningTier;
  daysAfterDue: number;
  render: (ctx: DunningContext) => string;
}

// Every body carries the STOP notice (carrier + TCPA requirement) and, when we
// have one, a public pay link. No em dashes — house style for outbound SMS.
export const DUNNING_LADDER: DunningStep[] = [
  {
    tier: 'gentle',
    daysAfterDue: 3,
    render: ({ firstName, invoiceNumber, amount, payUrl }) =>
      `NunezDev: Hi ${firstName}, a quick heads up that invoice ${invoiceNumber} for ${amount} is past due.` +
      (payUrl ? ` You can take care of it here: ${payUrl}` : '') +
      ` Reply STOP to opt out.`,
  },
  {
    tier: 'firm',
    daysAfterDue: 10,
    render: ({ firstName, invoiceNumber, amount, daysOverdue, payUrl }) =>
      `NunezDev: Hi ${firstName}, invoice ${invoiceNumber} for ${amount} is now ${daysOverdue} days past due.` +
      (payUrl ? ` Please pay when you can: ${payUrl}` : ' Please take care of it when you can.') +
      ` Reply here if you want to set up a plan. Reply STOP to opt out.`,
  },
  {
    tier: 'urgent',
    daysAfterDue: 21,
    render: ({ firstName, invoiceNumber, amount, daysOverdue, payUrl }) =>
      `NunezDev: Hi ${firstName}, invoice ${invoiceNumber} for ${amount} is ${daysOverdue} days overdue.` +
      ` To keep your site and services active, please pay soon.` +
      (payUrl ? ` ${payUrl}` : '') +
      ` Reply here if you need to work something out. Reply STOP to opt out.`,
  },
];

/**
 * Pure: pick the dunning rung to send for an invoice right now, or null.
 *
 * Returns the HIGHEST rung whose day-threshold is met — not the lowest unsent —
 * and only if that rung hasn't already been sent. Because days-overdue only
 * grows, the chosen rung climbs monotonically: once 'urgent' is due it's always
 * the highest, so we never regress to re-send 'gentle'/'firm'. A cron that skips
 * days therefore jumps a very-late invoice straight to its current rung instead
 * of replaying the whole ladder.
 */
export function selectDunningTier(
  daysOverdue: number,
  sentTiers: Iterable<string>,
  ladder: DunningStep[] = DUNNING_LADDER,
): DunningStep | null {
  let highestDue: DunningStep | null = null;
  for (const step of ladder) {
    if (daysOverdue >= step.daysAfterDue) highestDue = step;
  }
  if (!highestDue) return null; // not overdue enough for the first rung
  const sent = new Set(sentTiers);
  if (sent.has(highestDue.tier)) return null; // current rung already handled
  return highestDue;
}

/** Pure: render a rung's body for a given invoice context. */
export function renderDunningBody(step: DunningStep, ctx: DunningContext): string {
  return step.render(ctx);
}

/** Pure: format cents as USD, e.g. 123400 -> "$1,234.00". */
export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Pure: public pay link for an invoice, or '' when none is available. */
export function invoicePayUrl(
  inv: { access_token?: string | null; hosted_invoice_url?: string | null },
  baseUrl: string = BASE_URL,
): string {
  if (inv.access_token) return `${baseUrl}/invoice/${inv.access_token}`;
  return inv.hosted_invoice_url ?? '';
}

export interface DunningSummary {
  candidates: number;
  byStatus: Record<string, number>;
}

interface OverdueInvoiceRow {
  id: string;
  client_id: string;
  amount_cents: number | null;
  remaining_balance_cents: number | null;
  due_at: string;
  invoice_number: string | null;
  access_token: string | null;
  hosted_invoice_url: string | null;
  clients: { name: string | null } | { name: string | null }[] | null;
}

/**
 * Send due dunning texts for all overdue invoices. Called by the daily
 * process-invoice-followups cron, after the email ladder runs.
 *
 * reminderType is always 'payment_overdue' (the tier lives in the body + the
 * dedupe ledger); that type already has the per-org SMS toggle enabled, so we
 * don't need a notification_preferences change per rung.
 */
export async function processOverdueDunningSms(): Promise<DunningSummary> {
  const supabase = supabaseAdmin();
  const byStatus: Record<string, number> = { sent: 0 };
  const bump = (k: string) => (byStatus[k] = (byStatus[k] ?? 0) + 1);
  const record = (r: InvoiceReminderResult) => (r.ok ? bump('sent') : bump(r.reason ?? 'unknown'));

  const nowMs = Date.now();
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(
      'id, client_id, amount_cents, remaining_balance_cents, due_at, invoice_number, access_token, hosted_invoice_url, clients!inner(name)',
    )
    .eq('status', 'sent')
    .eq('is_suspended', false)
    .lt('due_at', new Date(nowMs).toISOString());

  if (error) {
    console.error('[dunningSms] failed to load overdue invoices:', error.message);
    return { candidates: 0, byStatus: { db_error: 1 } };
  }
  const rows = (invoices ?? []) as unknown as OverdueInvoiceRow[];
  if (rows.length === 0) return { candidates: 0, byStatus };

  // Batch-load already-sent tiers for all candidates (avoids an N+1 in the loop).
  const { data: sentRows } = await supabase
    .from('invoice_dunning_sms')
    .select('invoice_id, tier')
    .in('invoice_id', rows.map((r) => r.id));
  const sentByInvoice = new Map<string, Set<string>>();
  for (const s of (sentRows ?? []) as { invoice_id: string; tier: string }[]) {
    if (!sentByInvoice.has(s.invoice_id)) sentByInvoice.set(s.invoice_id, new Set());
    sentByInvoice.get(s.invoice_id)!.add(s.tier);
  }

  for (const inv of rows) {
    const remaining = inv.remaining_balance_cents ?? inv.amount_cents ?? 0;
    if (remaining <= 0) continue; // fully paid, nothing to chase

    const daysOverdue = Math.floor((nowMs - new Date(inv.due_at).getTime()) / 86_400_000);
    const step = selectDunningTier(daysOverdue, sentByInvoice.get(inv.id) ?? []);
    if (!step) continue;

    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    const firstName = (client?.name ?? '').trim().split(/\s+/)[0] || 'there';
    const invoiceNumber = inv.invoice_number || `INV-${inv.id.slice(-6).toUpperCase()}`;
    const body = renderDunningBody(step, {
      firstName,
      invoiceNumber,
      amount: formatUsd(remaining),
      daysOverdue,
      payUrl: invoicePayUrl(inv),
    });

    const result = await sendInvoiceReminderSms({
      invoiceId: inv.id,
      clientId: inv.client_id,
      reminderType: 'payment_overdue',
      body,
    });
    record(result);

    // Only mark the rung sent when the text actually went out. A quiet-hours or
    // transient skip leaves the ledger untouched so the next cron run retries.
    if (result.ok) {
      const { error: ledgerErr } = await supabase.from('invoice_dunning_sms').insert({
        invoice_id: inv.id,
        tier: step.tier,
        days_overdue: daysOverdue,
        twilio_sid: result.sid ?? null,
      });
      if (ledgerErr) {
        // The text already sent; a duplicate-key here just means a concurrent run
        // beat us. Log, don't throw.
        console.error(`[dunningSms] sent ${step.tier} for ${inv.id} but ledger insert failed:`, ledgerErr.message);
      }
    }
  }

  return { candidates: rows.length, byStatus };
}
