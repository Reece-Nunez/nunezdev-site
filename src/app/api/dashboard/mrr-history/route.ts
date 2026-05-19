/**
 * MRR over time — returns 12 monthly snapshots of recurring revenue.
 *
 * For each of the last 12 month-end points, computes the MRR that would
 * have been active at that exact moment by reconstructing from row history:
 *
 *   - Stripe subscriptions: active iff created_at <= snapshot AND
 *     (canceled_at IS NULL OR canceled_at > snapshot) AND
 *     ended_at IS NULL OR ended_at > snapshot
 *   - Legacy recurring_invoices: active iff created_at <= snapshot AND
 *     (NOT migrated OR migrated_at > snapshot) AND
 *     (end_date IS NULL OR end_date > snapshot)
 *
 * Pulls the rows once and computes all 12 buckets in memory — small data,
 * cheap, no historical row-level tracking required.
 *
 * Returns: { months: [{ month: 'YYYY-MM', mrrCents, subscriptionMrrCents, legacyMrrCents, activeCount }] }
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

function legacyFrequencyToInterval(frequency: string | null): {
  interval: string; interval_count: number;
} {
  switch (frequency) {
    case 'weekly': return { interval: 'week', interval_count: 1 };
    case 'quarterly': return { interval: 'month', interval_count: 3 };
    case 'annually': return { interval: 'year', interval_count: 1 };
    default: return { interval: 'month', interval_count: 1 };
  }
}

// Last day of the month containing `date`, at 23:59:59 UTC.
function endOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function monthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = supabaseAdmin();

  // Pull ALL subscription / legacy rows for this org — no time filter; we
  // need historical state including canceled / completed.
  const [subsRes, legacyRes] = await Promise.all([
    supabase
      .from('client_subscriptions')
      .select('amount_cents, interval, interval_count, created_at, canceled_at, ended_at, status')
      .eq('org_id', guard.orgId),
    supabase
      .from('recurring_invoices')
      .select('amount_cents, frequency, created_at, updated_at, end_date, status, migrated_to_subscription_at')
      .eq('org_id', guard.orgId),
  ]);

  type SubHistRow = {
    amount_cents: number | null;
    interval: string | null;
    interval_count: number | null;
    created_at: string;
    canceled_at: string | null;
    ended_at: string | null;
    status: string;
  };
  type LegacyHistRow = {
    amount_cents: number | null;
    frequency: string | null;
    created_at: string;
    updated_at: string;
    end_date: string | null;
    status: string;
    migrated_to_subscription_at: string | null;
  };

  const subs = (subsRes.data || []) as SubHistRow[];
  const legacyAll = (legacyRes.data || []) as LegacyHistRow[];

  // Build 12 month-end snapshots (oldest first)
  const months: {
    month: string;
    mrrCents: number;
    subscriptionMrrCents: number;
    legacyMrrCents: number;
    activeCount: number;
  }[] = [];

  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const snapshot = endOfMonthUTC(d);
    const snapshotIso = snapshot.toISOString();

    let subMrr = 0;
    let subCount = 0;
    for (const s of subs) {
      if (s.created_at > snapshotIso) continue; // not created yet
      if (s.canceled_at && s.canceled_at <= snapshotIso) continue; // already canceled
      if (s.ended_at && s.ended_at <= snapshotIso) continue; // ended
      // For historical snapshots only count statuses that imply billing.
      // We accept rows currently 'canceled' if they were still active at the
      // snapshot — the canceled_at check above already handles timing.
      if (s.status === 'incomplete' || s.status === 'incomplete_expired') continue;
      subMrr += toMonthlyCents(s);
      subCount += 1;
    }

    let legMrr = 0;
    let legCount = 0;
    for (const r of legacyAll) {
      if (r.created_at > snapshotIso) continue;
      // Status semantics: 'paused' / 'completed' / 'canceled' all stop billing.
      // KNOWN LIMITATION: legacy recurring_invoices lacks an explicit
      // canceled_at column. We approximate the stop time via updated_at,
      // which also changes on price edits / metadata tweaks. A row edited
      // (e.g., for an amount bump) in March and then canceled in May will
      // historically appear canceled in March in this report. For a solo
      // dev shop with few edits this is acceptable; if we ever need exact
      // historical accuracy, add a canceled_at column.
      if (r.status !== 'active' && r.updated_at <= snapshotIso) continue;
      // Migration to Stripe sub: stops contributing to legacy MRR after that point
      if (r.migrated_to_subscription_at && r.migrated_to_subscription_at <= snapshotIso) continue;
      if (r.end_date && r.end_date <= snapshotIso) continue;

      const i = legacyFrequencyToInterval(r.frequency);
      legMrr += toMonthlyCents({ ...i, amount_cents: r.amount_cents });
      legCount += 1;
    }

    months.push({
      month: monthKey(d),
      mrrCents: subMrr + legMrr,
      subscriptionMrrCents: subMrr,
      legacyMrrCents: legMrr,
      activeCount: subCount + legCount,
    });
  }

  // Month-over-month growth: last vs second-to-last
  const last = months[months.length - 1];
  const prior = months[months.length - 2];
  const momChangeCents = last && prior ? last.mrrCents - prior.mrrCents : 0;
  const momChangePct = last && prior && prior.mrrCents > 0
    ? Math.round(((last.mrrCents - prior.mrrCents) / prior.mrrCents) * 1000) / 10
    : null;

  return NextResponse.json({
    months,
    momChangeCents,
    momChangePct,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
