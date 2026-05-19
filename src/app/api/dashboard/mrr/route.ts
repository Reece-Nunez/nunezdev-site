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
 * Legacy recurring_invoices rows use 'frequency' instead of (interval, interval_count).
 * Mapped to a SubRow shape on read so toMonthlyCents can be reused.
 */
interface LegacyRecurringRow {
  amount_cents: number | null;
  frequency: string | null;
}

function legacyToSubRow(r: LegacyRecurringRow): SubRow {
  const map: Record<string, { interval: string; interval_count: number }> = {
    weekly: { interval: 'week', interval_count: 1 },
    monthly: { interval: 'month', interval_count: 1 },
    quarterly: { interval: 'month', interval_count: 3 },
    annually: { interval: 'year', interval_count: 1 },
  };
  const m = map[r.frequency || 'monthly'] || map.monthly;
  return {
    status: 'active',
    amount_cents: r.amount_cents,
    interval: m.interval,
    interval_count: m.interval_count,
  };
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

  const todayIso = new Date().toISOString();
  const [activeRes, pendingRes, legacyRes] = await Promise.all([
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
    // Legacy recurring_invoices that haven't been migrated to a Stripe sub
    // and haven't reached their end_date. These still bill via the cron and
    // contribute to current MRR.
    supabase
      .from('recurring_invoices')
      .select('amount_cents, frequency, end_date')
      .eq('org_id', guard.orgId)
      .eq('status', 'active')
      .is('stripe_subscription_id', null)
      .or(`end_date.is.null,end_date.gt.${todayIso}`),
  ]);

  const activeRows = (activeRes.data || []) as SubRow[];
  const pendingRows = (pendingRes.data || []) as ScheduleRow[];
  const legacyRows = (legacyRes.data || []) as LegacyRecurringRow[];

  const mrrCents = activeRows.reduce((sum, r) => sum + toMonthlyCents(r), 0);
  const legacyMrrCents = legacyRows.reduce(
    (sum, r) => sum + toMonthlyCents(legacyToSubRow(r)),
    0
  );

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

  // True MRR = Stripe subscriptions + legacy recurring invoices.
  // Pending schedules are NOT included here because they haven't started
  // billing yet (would inflate current revenue).
  const totalMrrCents = mrrCents + legacyMrrCents;

  return NextResponse.json({
    // Consolidated MRR — what the dashboard widget shows prominently
    totalMrrCents,

    // Stripe subscriptions breakdown (the path forward)
    mrrCents,
    activeCount: activeRows.length,
    trialingCount,
    pastDueCount,

    // Legacy recurring_invoices breakdown (rows that haven't been migrated)
    legacyMrrCents,
    legacyCount: legacyRows.length,

    // Pending schedules (future MRR — will start billing at start date)
    pendingMrrCents,
    pendingOneTimeCents,
    pendingCount: pendingRows.length,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
