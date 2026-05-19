/**
 * MRR (Monthly Recurring Revenue) widget data for the dashboard.
 *
 * Normalizes every active subscription to a monthly amount:
 *   - day/week → multiplied up to a month equivalent
 *   - month   → 1x
 *   - year    → divided by 12
 *
 * Returns:
 *   - mrrCents       : current MRR from active subscriptions
 *   - activeCount    : # of subs in active/trialing/past_due
 *   - trialingCount  : # of subs in trial
 *   - pendingMrrCents: MRR from schedules that haven't released yet
 *   - pendingCount   : # of pending schedules
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubRow {
  status: string;
  amount_cents: number | null;
  interval: string | null;
  interval_count: number | null;
}

interface ScheduleRow extends SubRow {
  end_behavior: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

/**
 * Normalize a subscription's amount to a monthly cents figure.
 * For day/week we approximate a month as 30.44 days. Yearly divides by 12.
 * Returns 0 when amount is null (tiered/usage pricing) or interval is
 * unrecognized — overcounting is worse than undercounting for MRR.
 */
function toMonthlyCents(row: SubRow): number {
  if (!row.amount_cents) return 0;
  const count = row.interval_count || 1;
  const perBillingCycle = row.amount_cents;
  switch (row.interval) {
    case 'day':
      return Math.round((perBillingCycle / count) * 30.44);
    case 'week':
      return Math.round((perBillingCycle / count) * (30.44 / 7));
    case 'month':
      return Math.round(perBillingCycle / count);
    case 'year':
      return Math.round(perBillingCycle / count / 12);
    default:
      console.warn('[mrr] unknown interval, excluding from MRR', { interval: row.interval });
      return 0;
  }
}

/**
 * A schedule is "recurring" if it will keep billing after its current phase
 * (end_behavior 'release' or 'renew') OR has no end date. A schedule set to
 * 'cancel' with a short defined window is effectively one-shot and shouldn't
 * be counted as future MRR.
 */
function isRecurringSchedule(row: ScheduleRow): boolean {
  if (row.end_behavior === 'cancel') {
    // Cancel-on-end is only "recurring" if the window is long enough that
    // it'll bill more than once. ~35 days catches monthly retainers with
    // a defined first phase that haven't yet rolled.
    if (!row.starts_at || !row.ends_at) return true;
    const durationMs = new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime();
    const days = durationMs / (1000 * 60 * 60 * 24);
    return days > 35;
  }
  // release / renew / null all keep billing past the first phase.
  return true;
}

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = supabaseAdmin();

  const [activeRes, pendingRes] = await Promise.all([
    supabase
      .from('client_subscriptions')
      .select('status, amount_cents, interval, interval_count')
      .eq('org_id', guard.orgId)
      .in('status', ['active', 'trialing', 'past_due']),
    supabase
      .from('client_subscription_schedules')
      .select('status, amount_cents, interval, interval_count, end_behavior, starts_at, ends_at')
      .eq('org_id', guard.orgId)
      .in('status', ['not_started', 'active']),
  ]);

  const activeRows = (activeRes.data || []) as SubRow[];
  const pendingRows = (pendingRes.data || []) as ScheduleRow[];

  const mrrCents = activeRows.reduce((sum, r) => sum + toMonthlyCents(r), 0);

  // Split pending into recurring (counts toward future MRR) and one-shot
  // (set to cancel after a short window — not real MRR even if scheduled).
  let pendingMrrCents = 0;
  let pendingOneTimeCents = 0;
  for (const row of pendingRows) {
    if (isRecurringSchedule(row)) {
      pendingMrrCents += toMonthlyCents(row);
    } else {
      pendingOneTimeCents += row.amount_cents || 0;
    }
  }

  const trialingCount = activeRows.filter((r) => r.status === 'trialing').length;
  const pastDueCount = activeRows.filter((r) => r.status === 'past_due').length;

  return NextResponse.json({
    mrrCents,
    activeCount: activeRows.length,
    trialingCount,
    pastDueCount,
    pendingMrrCents,
    pendingOneTimeCents,
    pendingCount: pendingRows.length,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
