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

/**
 * The owner-approval rung. Deliberately separate from the auto DUNNING_LADDER:
 * a 35-day "your site could be shut down" text is never sent by the cron. The
 * cron queues it for the owner (pending_sms_approvals) and it only goes out on an
 * explicit Approve. See Phase 3.
 */
export const SHUTDOWN_DAYS = 35;

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

/**
 * Pure: the 35-day shutdown-warning body. Firm but professional, carries the pay
 * link + STOP notice, no em dashes. This is what gets frozen into the approval
 * row and sent verbatim once the owner approves.
 */
export function renderShutdownBody(ctx: DunningContext): string {
  return (
    `NunezDev: ${ctx.firstName}, invoice ${ctx.invoiceNumber} for ${ctx.amount} is now ` +
    `${ctx.daysOverdue} days overdue and still unpaid. To avoid suspension of your website ` +
    `and services, payment is required now.` +
    (ctx.payUrl ? ` Pay here: ${ctx.payUrl}` : '') +
    ` Reply here to make arrangements. Reply STOP to opt out.`
  );
}

/**
 * Pure: should this invoice have a shutdown approval queued right now? True once
 * it crosses SHUTDOWN_DAYS and nothing is queued yet. `alreadyQueued` covers any
 * existing row (pending, approved, or dismissed) so we never re-surface a text the
 * owner already actioned.
 */
export function shutdownApprovalDue(
  daysOverdue: number,
  opts: { alreadyQueued: boolean },
): boolean {
  return daysOverdue >= SHUTDOWN_DAYS && !opts.alreadyQueued;
}

// ---- Chronic non-payer detection (Phase 4) ---------------------------------
// A client with an active recurring invoice who is this many billing cycles
// behind gets the direct, owner-approved treatment instead of the soft ladder.
export const CHRONIC_MIN_CYCLES = 3;

/** Pure: how many billing cycles an outstanding balance represents. */
export function cyclesBehind(outstandingCents: number, monthlyCents: number): number {
  if (monthlyCents <= 0) return 0;
  return Math.floor(outstandingCents / monthlyCents);
}

/**
 * Pure: is this client a chronic non-payer? Only clients on an active recurring
 * plan qualify, and only once their OVERDUE, non-void outstanding balance is
 * worth >= CHRONIC_MIN_CYCLES months of that plan. Counting overdue-and-non-void
 * is deliberate: void invoices here mean "bundled into a combined invoice" (the
 * combine flow), so the debt already lives in that combined invoice — counting
 * the voids too would double-count. Gating on overdue avoids nagging someone whose
 * consolidated invoice hasn't hit its due date yet.
 */
export function isChronicNonPayer(opts: {
  hasActiveRecurring: boolean;
  outstandingOverdueCents: number;
  monthlyCents: number;
}): boolean {
  if (!opts.hasActiveRecurring || opts.monthlyCents <= 0) return false;
  return cyclesBehind(opts.outstandingOverdueCents, opts.monthlyCents) >= CHRONIC_MIN_CYCLES;
}

/**
 * Pure: the blunt, client-level "you are seriously past due" body. About the
 * whole outstanding balance, not one invoice. Carries pay link + STOP, no em
 * dashes. Frozen into the approval row and sent verbatim once the owner approves.
 */
export function renderChronicDirectBody(ctx: {
  firstName: string;
  amount: string;
  cyclesBehind: number;
  payUrl: string;
}): string {
  const months = ctx.cyclesBehind === 1 ? 'month' : 'months';
  return (
    `NunezDev: ${ctx.firstName}, your account is seriously past due. You have ${ctx.amount} ` +
    `outstanding across ${ctx.cyclesBehind} unpaid ${months} of service, and it needs to be paid ` +
    `now to keep your services running.` +
    (ctx.payUrl ? ` Pay here: ${ctx.payUrl}` : '') +
    ` Reply here to make arrangements. Reply STOP to opt out.`
  );
}

export interface DunningSummary {
  candidates: number;
  byStatus: Record<string, number>;
  /** Shutdown texts queued for owner approval this run. */
  shutdownQueued: number;
  /** Chronic-non-payer direct texts queued for owner approval this run. */
  chronicQueued: number;
}

interface OverdueInvoiceRow {
  id: string;
  client_id: string;
  org_id: string;
  amount_cents: number | null;
  remaining_balance_cents: number | null;
  due_at: string;
  invoice_number: string | null;
  access_token: string | null;
  hosted_invoice_url: string | null;
  clients: { name: string | null } | { name: string | null }[] | null;
}

interface ClientOverdueAgg {
  outstanding: number;
  anchor: OverdueInvoiceRow;
  maxDaysOverdue: number;
  clientName: string | null;
  orgId: string;
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
      'id, client_id, org_id, amount_cents, remaining_balance_cents, due_at, invoice_number, access_token, hosted_invoice_url, clients!inner(name)',
    )
    .eq('status', 'sent')
    .eq('is_suspended', false)
    .lt('due_at', new Date(nowMs).toISOString());

  if (error) {
    console.error('[dunningSms] failed to load overdue invoices:', error.message);
    return { candidates: 0, byStatus: { db_error: 1 }, shutdownQueued: 0, chronicQueued: 0 };
  }
  const rows = (invoices ?? []) as unknown as OverdueInvoiceRow[];
  if (rows.length === 0) return { candidates: 0, byStatus, shutdownQueued: 0, chronicQueued: 0 };

  const invoiceIds = rows.map((r) => r.id);
  const clientIds = [...new Set(rows.map((r) => r.client_id))];

  // Batch-load already-sent tiers for all candidates (avoids an N+1 in the loop).
  const { data: sentRows } = await supabase
    .from('invoice_dunning_sms')
    .select('invoice_id, tier')
    .in('invoice_id', invoiceIds);
  const sentByInvoice = new Map<string, Set<string>>();
  for (const s of (sentRows ?? []) as { invoice_id: string; tier: string }[]) {
    if (!sentByInvoice.has(s.invoice_id)) sentByInvoice.set(s.invoice_id, new Set());
    sentByInvoice.get(s.invoice_id)!.add(s.tier);
  }

  // Batch-load invoices that already have a shutdown approval (any status) so we
  // never re-queue one the owner has already sent or dismissed.
  const { data: approvalRows } = await supabase
    .from('pending_sms_approvals')
    .select('invoice_id')
    .eq('tier', 'shutdown')
    .in('invoice_id', invoiceIds);
  const queuedInvoiceIds = new Set(
    ((approvalRows ?? []) as { invoice_id: string }[]).map((r) => r.invoice_id),
  );

  // Active recurring plans -> monthly commitment per client (summed if a client
  // has more than one active plan).
  const { data: recurringRows } = await supabase
    .from('recurring_invoices')
    .select('client_id, amount_cents')
    .eq('status', 'active')
    .in('client_id', clientIds);
  const monthlyByClient = new Map<string, number>();
  for (const r of (recurringRows ?? []) as { client_id: string; amount_cents: number | null }[]) {
    monthlyByClient.set(r.client_id, (monthlyByClient.get(r.client_id) ?? 0) + (r.amount_cents ?? 0));
  }

  // Per-client overdue aggregates: total outstanding + the most-overdue invoice
  // (used as the anchor + pay link for a client-level chronic approval).
  const aggByClient = new Map<string, ClientOverdueAgg>();
  for (const inv of rows) {
    const remaining = inv.remaining_balance_cents ?? inv.amount_cents ?? 0;
    if (remaining <= 0) continue;
    const days = Math.floor((nowMs - new Date(inv.due_at).getTime()) / 86_400_000);
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    const existing = aggByClient.get(inv.client_id);
    if (!existing) {
      aggByClient.set(inv.client_id, {
        outstanding: remaining,
        anchor: inv,
        maxDaysOverdue: days,
        clientName: client?.name ?? null,
        orgId: inv.org_id,
      });
    } else {
      existing.outstanding += remaining;
      if (days > existing.maxDaysOverdue) {
        existing.maxDaysOverdue = days;
        existing.anchor = inv;
      }
    }
  }

  // Chronic non-payers: active recurring + 3+ cycles of overdue debt.
  const chronicClientIds = new Set<string>();
  for (const [clientId, agg] of aggByClient) {
    const monthly = monthlyByClient.get(clientId) ?? 0;
    if (isChronicNonPayer({ hasActiveRecurring: monthly > 0, outstandingOverdueCents: agg.outstanding, monthlyCents: monthly })) {
      chronicClientIds.add(clientId);
    }
  }

  // Client-level dedupe for chronic approvals: skip if one is already pending or
  // was resolved in the last 30 days (don't re-nag every run or every month).
  const chronicCutoffIso = new Date(nowMs - 30 * 86_400_000).toISOString();
  const chronicHandled = new Set<string>();
  if (chronicClientIds.size > 0) {
    const { data: chronicRows } = await supabase
      .from('pending_sms_approvals')
      .select('client_id, status, resolved_at')
      .eq('tier', 'chronic_direct')
      .in('client_id', [...chronicClientIds]);
    for (const r of (chronicRows ?? []) as { client_id: string; status: string; resolved_at: string | null }[]) {
      if (r.status === 'pending' || (r.resolved_at && r.resolved_at >= chronicCutoffIso)) {
        chronicHandled.add(r.client_id);
      }
    }
  }

  let shutdownQueued = 0;
  let chronicQueued = 0;

  // Per-invoice pass: auto ladder + shutdown approval. Chronic clients are skipped
  // here so they don't get soft nudges on top of the direct approval queued below.
  for (const inv of rows) {
    if (chronicClientIds.has(inv.client_id)) continue;

    const remaining = inv.remaining_balance_cents ?? inv.amount_cents ?? 0;
    if (remaining <= 0) continue; // fully paid, nothing to chase

    const daysOverdue = Math.floor((nowMs - new Date(inv.due_at).getTime()) / 86_400_000);
    const client = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
    const firstName = (client?.name ?? '').trim().split(/\s+/)[0] || 'there';
    const invoiceNumber = inv.invoice_number || `INV-${inv.id.slice(-6).toUpperCase()}`;
    const ctx: DunningContext = {
      firstName,
      invoiceNumber,
      amount: formatUsd(remaining),
      daysOverdue,
      payUrl: invoicePayUrl(inv),
    };

    // Auto rungs (gentle/firm/urgent): sent by the cron, once per rung.
    const step = selectDunningTier(daysOverdue, sentByInvoice.get(inv.id) ?? []);
    if (step) {
      const result = await sendInvoiceReminderSms({
        invoiceId: inv.id,
        clientId: inv.client_id,
        reminderType: 'payment_overdue',
        body: renderDunningBody(step, ctx),
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

    // Shutdown rung: NEVER auto-sent. Queue it for owner approval instead. This
    // runs independently of the auto rung above so a very-late invoice (whose auto
    // rungs are done or held) still surfaces for review.
    if (shutdownApprovalDue(daysOverdue, { alreadyQueued: queuedInvoiceIds.has(inv.id) })) {
      const { error: queueErr } = await supabase
        .from('pending_sms_approvals')
        .upsert(
          {
            invoice_id: inv.id,
            client_id: inv.client_id,
            org_id: inv.org_id,
            tier: 'shutdown',
            body: renderShutdownBody(ctx),
            days_overdue: daysOverdue,
            amount_cents: remaining,
            client_name: client?.name ?? null,
            invoice_number: invoiceNumber,
          },
          { onConflict: 'invoice_id,tier', ignoreDuplicates: true },
        );
      if (queueErr) {
        console.error(`[dunningSms] failed to queue shutdown approval for ${inv.id}:`, queueErr.message);
      } else {
        shutdownQueued += 1;
      }
    }
  }

  // Chronic pass: one client-level direct approval per chronic non-payer. Anchored
  // to the client's most-overdue invoice (for the FK + pay link), but the message
  // is about the whole outstanding balance.
  for (const clientId of chronicClientIds) {
    if (chronicHandled.has(clientId)) continue;
    const agg = aggByClient.get(clientId);
    if (!agg) continue;
    const monthly = monthlyByClient.get(clientId) ?? 0;
    const firstName = (agg.clientName ?? '').trim().split(/\s+/)[0] || 'there';
    const body = renderChronicDirectBody({
      firstName,
      amount: formatUsd(agg.outstanding),
      cyclesBehind: cyclesBehind(agg.outstanding, monthly),
      payUrl: invoicePayUrl(agg.anchor),
    });
    const { error: queueErr } = await supabase.from('pending_sms_approvals').upsert(
      {
        invoice_id: agg.anchor.id,
        client_id: clientId,
        org_id: agg.orgId,
        tier: 'chronic_direct',
        body,
        days_overdue: agg.maxDaysOverdue,
        amount_cents: agg.outstanding,
        client_name: agg.clientName,
        invoice_number: agg.anchor.invoice_number || `INV-${agg.anchor.id.slice(-6).toUpperCase()}`,
      },
      { onConflict: 'invoice_id,tier', ignoreDuplicates: true },
    );
    if (queueErr) {
      console.error(`[dunningSms] failed to queue chronic approval for client ${clientId}:`, queueErr.message);
    } else {
      chronicQueued += 1;
    }
  }

  return { candidates: rows.length, byStatus, shutdownQueued, chronicQueued };
}
