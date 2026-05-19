/**
 * Invoice revenue mix over the last N months — splits realized payments
 * from the local invoices table into "Recurring" (came from a
 * recurring_invoice schedule) vs "One-off" (project milestones, one-time
 * charges, payment plan installments).
 *
 * IMPORTANT — what this DOES NOT include:
 *   Stripe Subscription invoice payments are NOT counted here. By design
 *   (Phase 5), subscription invoices live in Stripe and we don't mirror
 *   them locally. As Stripe subs become the dominant recurring channel,
 *   the "Recurring" slice here will shrink even though total recurring
 *   revenue is growing — the MRR-history chart is the authoritative view
 *   for recurring revenue. TODO: union subscription invoice payments
 *   from Stripe API when this becomes material.
 *
 * Sources:
 *   - invoice_payments joined to invoices to determine origin
 *   - recurring_invoice_id NOT NULL → recurring
 *   - everything else → one-off
 *
 * Default window: last 6 months including current.
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PaymentRow {
  amount_cents: number | null;
  paid_at: string | null;
  invoice_id: string;
  invoice?: {
    recurring_invoice_id: string | null;
    stripe_invoice_id: string | null;
    org_id: string;
  } | null;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const monthsBack = Math.max(1, Math.min(24, parseInt(url.searchParams.get('months') || '6', 10)));

  const supabase = supabaseAdmin();
  const now = new Date();
  // Window start: the first of (current month - monthsBack + 1)
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack + 1, 1));
  const startIso = start.toISOString();

  // Pull all payments in the window for THIS org. invoice_payments has no
  // direct org_id column, so we filter via the joined invoices table.
  // !inner makes the filter a join condition (not post-hoc) so Postgres
  // doesn't ship the entire org's payments back to the API layer first.
  // supabaseAdmin bypasses RLS — this filter is the only org boundary.
  const { data, error } = await supabase
    .from('invoice_payments')
    .select(
      `amount_cents, paid_at, invoice_id,
       invoice:invoices!inner(recurring_invoice_id, stripe_invoice_id, org_id)`
    )
    .eq('invoice.org_id', guard.orgId)
    .gte('paid_at', startIso)
    .order('paid_at', { ascending: true });

  if (error) {
    console.error('[revenue-mix]', error);
    return NextResponse.json({ error: 'Failed to load revenue mix' }, { status: 500 });
  }

  // Join helper — Supabase types nest as array
  type InvoiceJoin = {
    recurring_invoice_id: string | null;
    stripe_invoice_id: string | null;
    org_id: string;
  };
  const unwrapInvoice = (j: unknown): InvoiceJoin | null => {
    if (!j) return null;
    if (Array.isArray(j)) return (j[0] as InvoiceJoin) || null;
    return j as InvoiceJoin;
  };

  // Bucket each payment into the month it landed, attributed to org
  const buckets = new Map<string, { recurringCents: number; oneOffCents: number }>();

  // Seed all months in the window so the chart has zero-data points instead of gaps
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1 - i), 1));
    buckets.set(monthKey(d), { recurringCents: 0, oneOffCents: 0 });
  }

  for (const p of ((data || []) as unknown) as PaymentRow[]) {
    if (!p.paid_at) continue;
    const inv = unwrapInvoice(p.invoice);
    if (!inv || inv.org_id !== guard.orgId) continue; // wrong org or orphan

    const k = monthKey(new Date(p.paid_at));
    const b = buckets.get(k) || { recurringCents: 0, oneOffCents: 0 };
    const isRecurring = !!inv.recurring_invoice_id;
    if (isRecurring) b.recurringCents += p.amount_cents || 0;
    else b.oneOffCents += p.amount_cents || 0;
    buckets.set(k, b);
  }

  // Materialize sorted result
  const months = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      recurringCents: v.recurringCents,
      oneOffCents: v.oneOffCents,
      totalCents: v.recurringCents + v.oneOffCents,
    }));

  // Aggregate totals across the window
  const totalRecurring = months.reduce((s, m) => s + m.recurringCents, 0);
  const totalOneOff = months.reduce((s, m) => s + m.oneOffCents, 0);
  const grandTotal = totalRecurring + totalOneOff;
  const recurringPct = grandTotal > 0
    ? Math.round((totalRecurring / grandTotal) * 1000) / 10
    : null;

  return NextResponse.json({
    months,
    totals: {
      recurringCents: totalRecurring,
      oneOffCents: totalOneOff,
      totalCents: grandTotal,
      recurringPct,
    },
    period: { monthsBack, startIso },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
