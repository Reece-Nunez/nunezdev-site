'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type ArrangementSource = 'stripe_subscription' | 'stripe_schedule' | 'legacy_invoice';

interface Arrangement {
  id: string;
  source: ArrangementSource;
  clientId: string;
  clientName: string;
  title: string;
  amountCents: number | null;
  monthlyEquivalentCents: number;
  interval: string | null;
  intervalCount: number | null;
  status: string;
  nextBillAt: string | null;
  cancelAtPeriodEnd: boolean;
  isFutureRevenue: boolean;
}

interface MrrData {
  totalMrrCents: number;
  mrrCents: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  legacyMrrCents: number;
  legacyCount: number;
  pendingMrrCents: number;
  pendingOneTimeCents: number;
  pendingCount: number;
  arrangements: Arrangement[];
}

function fmtCurrency(cents: number | null): string {
  if (cents === null) return 'Variable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtInterval(interval: string | null, count: number | null): string {
  if (!interval) return '';
  const n = count || 1;
  return n === 1 ? `/${interval.slice(0, 2)}` : `/${n}${interval.slice(0, 1)}`;
}

function sourceBadge(source: ArrangementSource): { label: string; cls: string } {
  switch (source) {
    case 'stripe_subscription':
      return { label: 'Auto-pay', cls: 'bg-emerald-100 text-emerald-700' };
    case 'stripe_schedule':
      return { label: 'Scheduled', cls: 'bg-indigo-100 text-indigo-700' };
    case 'legacy_invoice':
      return { label: 'Invoice', cls: 'bg-slate-100 text-slate-700' };
  }
}

function statusBadge(status: string, cancelAtPeriodEnd: boolean): { label: string; cls: string } | null {
  if (cancelAtPeriodEnd) return { label: 'Canceling', cls: 'bg-amber-100 text-amber-700' };
  if (status === 'past_due') return { label: 'Past due', cls: 'bg-red-100 text-red-700' };
  if (status === 'trialing') return { label: 'Trial', cls: 'bg-sky-100 text-sky-700' };
  if (status === 'not_started') return null; // covered by source badge
  return null;
}

export default function MrrWidget() {
  const [data, setData] = useState<MrrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dashboard/mrr', { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const json: MrrData = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-2">Recurring Revenue</h3>
        <div className="text-xs text-gray-500 text-center py-3">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-2">Recurring Revenue</h3>
        <div className="text-xs text-red-600 text-center py-3">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const arrangements = data.arrangements || [];
  const empty = arrangements.length === 0;
  const VISIBLE = 6;
  const visible = showAll ? arrangements : arrangements.slice(0, VISIBLE);

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Recurring Revenue
        </h3>
        <Link
          href="/dashboard/recurring-invoices"
          className="text-xs text-emerald-700 hover:underline"
        >
          Manage →
        </Link>
      </div>

      {empty ? (
        <p className="text-sm text-gray-500">
          No recurring revenue yet. Set up a subscription or recurring invoice to start tracking.
        </p>
      ) : (
        <>
          {/* Headline total */}
          <div className="mb-2">
            <div className="text-2xl font-bold text-gray-900">
              {fmtCurrency(data.totalMrrCents)}
              <span className="text-sm font-normal text-gray-500"> / mo</span>
            </div>
            <div className="text-xs text-gray-500">
              Currently billing
              {data.pendingMrrCents > 0 && (
                <span className="text-indigo-600">
                  {' '}· {fmtCurrency(data.pendingMrrCents)}/mo scheduled
                </span>
              )}
              {data.pastDueCount > 0 && (
                <span className="text-red-600">
                  {' '}· {data.pastDueCount} past due
                </span>
              )}
            </div>
          </div>

          {/* Per-source breakdown — only show when both sources have value */}
          {data.mrrCents > 0 && data.legacyMrrCents > 0 && (
            <div className="text-xs text-gray-500 border-t border-b py-2 mb-2 flex gap-4">
              <span>
                Auto-pay <span className="text-gray-900 font-medium">{fmtCurrency(data.mrrCents)}</span>
              </span>
              <span>
                Invoiced <span className="text-gray-900 font-medium">{fmtCurrency(data.legacyMrrCents)}</span>
              </span>
            </div>
          )}

          {/* Unified arrangement list */}
          <div className="space-y-1.5">
            {visible.map((a) => {
              const src = sourceBadge(a.source);
              const st = statusBadge(a.status, a.cancelAtPeriodEnd);
              return (
                <Link
                  key={`${a.source}-${a.id}`}
                  href={`/dashboard/clients/${a.clientId}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {a.clientName}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${src.cls}`}>
                        {src.label}
                      </span>
                      {st && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.cls}`}>
                          {st.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {a.title}
                      {a.nextBillAt && (
                        <>
                          {' '}· {a.isFutureRevenue ? 'starts' : 'next'} {fmtDate(a.nextBillAt)}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-gray-900">
                      {fmtCurrency(a.amountCents)}
                      <span className="text-xs font-normal text-gray-400">
                        {fmtInterval(a.interval, a.intervalCount)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {arrangements.length > VISIBLE && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-xs text-emerald-700 hover:underline w-full text-center"
            >
              {showAll ? 'Show less' : `Show all ${arrangements.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
