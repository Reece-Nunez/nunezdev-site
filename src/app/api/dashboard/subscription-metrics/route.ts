/**
 * Lightweight subscription metrics for the dashboard:
 *
 *   - New MRR this month (revenue from arrangements that started this month)
 *   - Churned MRR this month (revenue from arrangements canceled this month)
 *   - Churn rate (% of MRR-at-start-of-month that churned)
 *   - Net new MRR (new - churned)
 *
 * Computed in TS over a small dataset — see /api/dashboard/mrr-history for
 * the same scale rationale.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IntervalRow {
  amount_cents: number | null;
  interval: string | null;
  interval_count: number | null;
}

function toMonthlyCents(r: IntervalRow): number {
  if (!r.amount_cents) return 0;
  const count = r.interval_count || 1;
  const perCycle = r.amount_cents;
  switch (r.interval) {
    case 'day': return Math.round((perCycle / count) * 30.44);
    case 'week': return Math.round((perCycle / count) * (30.44 / 7));
    case 'month': return Math.round(perCycle / count);
    case 'year': return Math.round(perCycle / count / 12);
    default: return 0;
  }
}

function legacyFreqToInterval(frequency: string | null) {
  switch (frequency) {
    case 'weekly': return { interval: 'week', interval_count: 1 };
    case 'quarterly': return { interval: 'month', interval_count: 3 };
    case 'annually': return { interval: 'year', interval_count: 1 };
    default: return { interval: 'month', interval_count: 1 };
  }
}

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = supabaseAdmin();
  const now = new Date();
  // Window: current calendar month, UTC
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthStartIso = monthStart.toISOString();
  const nowIso = now.toISOString();

  const [subsRes, legacyRes] = await Promise.all([
    supabase
      .from('client_subscriptions')
      .select('amount_cents, interval, interval_count, created_at, canceled_at, ended_at, status')
      .eq('org_id', guard.orgId),
    supabase
      .from('recurring_invoices')
      .select('amount_cents, frequency, created_at, updated_at, status, end_date, migrated_to_subscription_at')
      .eq('org_id', guard.orgId),
  ]);

  type SubRow = {
    amount_cents: number | null;
    interval: string | null;
    interval_count: number | null;
    created_at: string;
    canceled_at: string | null;
    ended_at: string | null;
    status: string;
  };
  type LegacyRow = {
    amount_cents: number | null;
    frequency: string | null;
    created_at: string;
    updated_at: string;
    status: string;
    end_date: string | null;
    migrated_to_subscription_at: string | null;
  };

  const subs = (subsRes.data || []) as SubRow[];
  const legacy = (legacyRes.data || []) as LegacyRow[];

  // MRR at month start (denominator for churn)
  let mrrAtStart = 0;
  for (const s of subs) {
    if (s.created_at >= monthStartIso) continue;
    if (s.canceled_at && s.canceled_at < monthStartIso) continue;
    if (s.ended_at && s.ended_at < monthStartIso) continue;
    if (s.status === 'incomplete' || s.status === 'incomplete_expired') continue;
    mrrAtStart += toMonthlyCents(s);
  }
  for (const r of legacy) {
    if (r.created_at >= monthStartIso) continue;
    if (r.status !== 'active' && r.updated_at < monthStartIso) continue;
    if (r.migrated_to_subscription_at && r.migrated_to_subscription_at < monthStartIso) continue;
    if (r.end_date && r.end_date < monthStartIso) continue;
    mrrAtStart += toMonthlyCents({ ...legacyFreqToInterval(r.frequency), amount_cents: r.amount_cents });
  }

  // New MRR this month — arrangements that came online between monthStart and now
  let newMrrCents = 0;
  let newCount = 0;
  for (const s of subs) {
    if (s.created_at < monthStartIso || s.created_at > nowIso) continue;
    if (s.status === 'incomplete' || s.status === 'incomplete_expired') continue;
    newMrrCents += toMonthlyCents(s);
    newCount += 1;
  }
  for (const r of legacy) {
    if (r.created_at < monthStartIso || r.created_at > nowIso) continue;
    if (r.status !== 'active') continue;
    newMrrCents += toMonthlyCents({ ...legacyFreqToInterval(r.frequency), amount_cents: r.amount_cents });
    newCount += 1;
  }

  // Churned MRR this month — arrangements canceled / ended / migrated this month
  let churnedMrrCents = 0;
  let churnedCount = 0;
  for (const s of subs) {
    const stop = s.canceled_at || s.ended_at;
    if (!stop) continue;
    if (stop < monthStartIso || stop > nowIso) continue;
    // Only count things that were billing before this month
    if (s.created_at >= monthStartIso) continue;
    churnedMrrCents += toMonthlyCents(s);
    churnedCount += 1;
  }
  for (const r of legacy) {
    // Migration to a Stripe Subscription is NOT churn — revenue moved
    // channels, it wasn't lost. Skip migrated rows entirely (the
    // corresponding subscription row carries that MRR forward).
    if (r.migrated_to_subscription_at) continue;
    // Legacy "churn" = transitioned out of 'active' (paused/completed/canceled).
    // We approximate the stop time via updated_at — see mrr-history for the
    // limitation note on this proxy.
    if (r.status === 'active') continue;
    const stop = r.updated_at;
    if (stop < monthStartIso || stop > nowIso) continue;
    if (r.created_at >= monthStartIso) continue;
    churnedMrrCents += toMonthlyCents({ ...legacyFreqToInterval(r.frequency), amount_cents: r.amount_cents });
    churnedCount += 1;
  }

  const netNewMrrCents = newMrrCents - churnedMrrCents;
  const churnRatePct = mrrAtStart > 0
    ? Math.round((churnedMrrCents / mrrAtStart) * 1000) / 10
    : null;

  return NextResponse.json({
    mrrAtStartCents: mrrAtStart,
    newMrrCents,
    newCount,
    churnedMrrCents,
    churnedCount,
    netNewMrrCents,
    churnRatePct,
    period: 'current_month',
    periodStart: monthStartIso,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
