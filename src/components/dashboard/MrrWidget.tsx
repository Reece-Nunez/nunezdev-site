'use client';

import { useEffect, useState } from 'react';

interface MrrData {
  mrrCents: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  pendingMrrCents: number;
  pendingOneTimeCents: number;
  pendingCount: number;
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export default function MrrWidget() {
  const [data, setData] = useState<MrrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // If nothing is set up yet, show a friendly placeholder rather than $0
  // (helps distinguish "no subscriptions" from "all canceled")
  const nothingHere = data.activeCount === 0 && data.pendingCount === 0;

  return (
    <div className="bg-white border rounded-xl p-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
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

      {nothingHere ? (
        <p className="text-sm text-gray-500">
          No active subscriptions yet. Set one up in Stripe to start tracking MRR.
        </p>
      ) : (
        <>
          <div className="mb-3">
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(data.mrrCents)}</div>
            <div className="text-xs text-gray-500">
              MRR · {data.activeCount} active subscription{data.activeCount === 1 ? '' : 's'}
            </div>
          </div>

          <div className="space-y-1.5 text-sm">
            {data.trialingCount > 0 && (
              <div className="flex items-center justify-between text-sky-700">
                <span>In trial</span>
                <span className="font-medium">{data.trialingCount}</span>
              </div>
            )}
            {data.pastDueCount > 0 && (
              <div className="flex items-center justify-between text-red-700">
                <span>Past due — needs attention</span>
                <span className="font-medium">{data.pastDueCount}</span>
              </div>
            )}
            {data.pendingCount > 0 && (
              <div className="text-indigo-700 pt-1 border-t space-y-0.5">
                <div className="flex items-center justify-between">
                  <span>Scheduled ({data.pendingCount})</span>
                </div>
                {data.pendingMrrCents > 0 && (
                  <div className="text-xs text-indigo-600">
                    Will add {fmtCurrency(data.pendingMrrCents)}/mo when active
                  </div>
                )}
                {data.pendingOneTimeCents > 0 && (
                  <div className="text-xs text-slate-500">
                    Plus {fmtCurrency(data.pendingOneTimeCents)} one-time
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
