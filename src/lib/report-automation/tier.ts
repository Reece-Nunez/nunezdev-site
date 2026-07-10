/**
 * Report tier resolution.
 *
 * A client's monthly report tier follows the Care Plan they actually pay for
 * (see the pricing page): Essential ($150), Growth ($250), Premium ($500).
 * Below the Essential floor there is no monthly report. Rather than store a
 * tier by hand, we DERIVE it from the client's live recurring revenue so the
 * report can never drift out of sync with what they're billed.
 *
 * Recurring revenue can come from three places, all normalized to a monthly
 * amount here:
 *   - `client_subscriptions`          — active Stripe subscriptions (mirror)
 *   - `client_subscription_schedules` — Stripe schedules not yet released
 *   - `recurring_invoices`            — manual recurring invoices we bill
 *
 * The pure helpers (normalization + threshold mapping) are unit-tested; the DB
 * query wrapper is a thin shell around them.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ReportTier = 'essential' | 'growth' | 'premium';

/**
 * Monthly-cent floors for each tier, highest first. A client's tier is the
 * highest plan whose price their normalized monthly revenue meets or exceeds.
 * Mirrors the Care Plan prices ($150 / $250 / $500). Keep in sync with the
 * pricing page.
 */
export const TIER_THRESHOLDS_CENTS: ReadonlyArray<{ tier: ReportTier; minMonthlyCents: number }> = [
  { tier: 'premium', minMonthlyCents: 50000 },
  { tier: 'growth', minMonthlyCents: 25000 },
  { tier: 'essential', minMonthlyCents: 15000 },
];

/**
 * Normalize a Stripe-style cadence (interval + interval_count) to a monthly
 * cent amount. `interval_count` is the number of intervals between charges, so
 * a `month`/3 subscription bills quarterly and its monthly-equivalent is a
 * third of the charge. Unknown intervals are treated as already-monthly rather
 * than silently dropped.
 */
export function stripeMonthlyCents(
  amountCents: number,
  interval: string | null | undefined,
  intervalCount: number | null | undefined = 1,
): number {
  const n = intervalCount && intervalCount > 0 ? intervalCount : 1;
  switch (interval) {
    case 'day':
      return (amountCents * 365) / 12 / n;
    case 'week':
      return (amountCents * 52) / 12 / n;
    case 'month':
      return amountCents / n;
    case 'year':
      return amountCents / (12 * n);
    default:
      return amountCents;
  }
}

/**
 * Normalize a recurring-invoice `frequency` string to a monthly cent amount.
 * Frequencies match `recurringInvoices.ts` (`weekly | monthly | quarterly |
 * annually`); anything else is treated as monthly.
 */
export function invoiceMonthlyCents(amountCents: number, frequency: string | null | undefined): number {
  switch (frequency) {
    case 'weekly':
      return (amountCents * 52) / 12;
    case 'monthly':
      return amountCents;
    case 'quarterly':
      return amountCents / 3;
    case 'annually':
      return amountCents / 12;
    default:
      return amountCents;
  }
}

/** Map a normalized monthly amount to a tier, or null if below the $150 floor. */
export function pickTier(monthlyCents: number): ReportTier | null {
  for (const t of TIER_THRESHOLDS_CENTS) {
    if (monthlyCents >= t.minMonthlyCents) return t.tier;
  }
  return null;
}

export type TierSource = 'subscription' | 'schedule' | 'recurring_invoice' | 'none';

export interface ResolvedTier {
  /** Report tier, or null when the client pays less than the Essential floor. */
  tier: ReportTier | null;
  /** The winning source's normalized monthly amount, rounded to whole cents. */
  monthlyCents: number;
  /** Which revenue source set the tier (for display / auditing). */
  source: TierSource;
}

// A subscription still "counts" as an active plan while it's live, on trial, or
// merely behind on payment — only canceled/unpaid/paused plans stop a report.
const ACTIVE_SUB_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * Resolve a client's report tier from their highest active recurring plan.
 *
 * We take the MAX monthly amount across sources, never the sum: the same Care
 * Plan is frequently mirrored in two tables (a schedule that released into a
 * subscription, or a recurring invoice later enrolled in Stripe auto-pay), and
 * summing would double-count it into a higher tier than the client pays for.
 */
export async function resolveReportTier(
  supabase: SupabaseClient,
  orgId: string,
  clientId: string,
): Promise<ResolvedTier> {
  const candidates: { monthlyCents: number; source: TierSource }[] = [];

  const [subs, schedules, recurring] = await Promise.all([
    supabase
      .from('client_subscriptions')
      .select('amount_cents, interval, interval_count, status')
      .eq('org_id', orgId)
      .eq('client_id', clientId)
      .in('status', ACTIVE_SUB_STATUSES),
    supabase
      .from('client_subscription_schedules')
      .select('amount_cents, interval, interval_count, status')
      .eq('org_id', orgId)
      .eq('client_id', clientId)
      .eq('status', 'active'),
    // Skip rows already migrated to a Stripe subscription — that subscription
    // is counted above, and this row is no longer billed (mirrors the guard in
    // recurringInvoices.ts).
    supabase
      .from('recurring_invoices')
      .select('amount_cents, frequency, status, stripe_subscription_id')
      .eq('org_id', orgId)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .is('stripe_subscription_id', null),
  ]);

  for (const s of subs.data ?? []) {
    if (s.amount_cents == null) continue;
    candidates.push({
      monthlyCents: stripeMonthlyCents(s.amount_cents, s.interval, s.interval_count),
      source: 'subscription',
    });
  }
  for (const s of schedules.data ?? []) {
    if (s.amount_cents == null || !s.interval) continue;
    candidates.push({
      monthlyCents: stripeMonthlyCents(s.amount_cents, s.interval, s.interval_count),
      source: 'schedule',
    });
  }
  for (const r of recurring.data ?? []) {
    if (r.amount_cents == null) continue;
    candidates.push({
      monthlyCents: invoiceMonthlyCents(r.amount_cents, r.frequency),
      source: 'recurring_invoice',
    });
  }

  if (candidates.length === 0) return { tier: null, monthlyCents: 0, source: 'none' };

  const top = candidates.reduce((a, b) => (b.monthlyCents > a.monthlyCents ? b : a));
  return { tier: pickTier(top.monthlyCents), monthlyCents: Math.round(top.monthlyCents), source: top.source };
}
