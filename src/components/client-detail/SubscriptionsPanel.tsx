'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface StripePrice {
  priceId: string;
  productId: string;
  productName: string;
  amountCents: number | null;
  currency: string;
  interval: string;
  intervalCount: number;
  nickname: string | null;
}

interface ActiveSubscription {
  id: string;
  stripe_subscription_id: string;
  status: string;
  product_name: string | null;
  amount_cents: number | null;
  currency: string;
  interval: string | null;
  interval_count: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_end: string | null;
}

interface PendingSchedule {
  id: string;
  stripe_schedule_id: string;
  status: string;
  product_name: string | null;
  amount_cents: number | null;
  currency: string;
  interval: string | null;
  interval_count: number | null;
  starts_at: string | null;
  ends_at: string | null;
  end_behavior: string | null;
}

interface HistoryRow {
  id: string;
  stripe_subscription_id: string;
  status: string;
  product_name: string | null;
  amount_cents: number | null;
  currency: string;
  interval: string | null;
  canceled_at: string | null;
  ended_at: string | null;
}

interface ApiResponse {
  client: { id: string; name: string; email: string | null; stripeCustomerId: string | null };
  active: ActiveSubscription[];
  pending: PendingSchedule[];
  history: HistoryRow[];
}

function formatMoney(cents: number | null, currency: string = 'usd'): string {
  if (cents === null || cents === undefined) return 'Variable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatInterval(interval: string | null, count: number | null): string {
  if (!interval) return '';
  const n = count || 1;
  if (n === 1) return `/${interval}`;
  return `every ${n} ${interval}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusBadge(status: string, canceling = false): { label: string; cls: string } {
  if (canceling) {
    return { label: 'Canceling at period end', cls: 'bg-amber-100 text-amber-800' };
  }
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-800' },
    trialing: { label: 'Trialing', cls: 'bg-sky-100 text-sky-800' },
    past_due: { label: 'Past due', cls: 'bg-red-100 text-red-800' },
    unpaid: { label: 'Unpaid', cls: 'bg-red-100 text-red-800' },
    paused: { label: 'Paused', cls: 'bg-slate-100 text-slate-800' },
    incomplete: { label: 'Incomplete', cls: 'bg-amber-100 text-amber-800' },
    not_started: { label: 'Scheduled', cls: 'bg-indigo-100 text-indigo-800' },
    canceled: { label: 'Canceled', cls: 'bg-slate-100 text-slate-600' },
    incomplete_expired: { label: 'Expired', cls: 'bg-slate-100 text-slate-600' },
  };
  return map[status] || { label: status, cls: 'bg-slate-100 text-slate-800' };
}

export default function SubscriptionsPanel({ clientId }: { clientId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // id of sub currently being toggled
  const [openingPortal, setOpeningPortal] = useState(false);
  const [showNewSub, setShowNewSub] = useState(false);
  const [prices, setPrices] = useState<StripePrice[] | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [startingCheckout, setStartingCheckout] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/subscriptions`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load subscriptions', err);
      toast.error(`Could not load subscriptions: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  // ESC closes the New Subscription modal
  useEffect(() => {
    if (!showNewSub) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNewSub(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNewSub]);

  const handleToggleCancel = async (sub: ActiveSubscription, nextCancel: boolean) => {
    setBusy(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.stripe_subscription_id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_at_period_end: nextCancel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      toast.success(
        nextCancel
          ? 'Subscription will end at the close of the current period.'
          : 'Cancellation reverted — subscription will continue billing.'
      );

      // Optimistically update local state so the UI reflects the change
      // immediately. The webhook will reconcile when it lands.
      setData((prev) =>
        prev
          ? {
              ...prev,
              active: prev.active.map((s) =>
                s.id === sub.id ? { ...s, cancel_at_period_end: nextCancel } : s
              ),
            }
          : prev
      );

      // Webhook delivery can take a few seconds under load; give it room
      // before refetching authoritative state. Keep `busy` until reload
      // finishes so the user can't double-click.
      await new Promise((r) => setTimeout(r, 3000));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setBusy(null);
    }
  };

  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-session`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not open portal');
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open portal');
    } finally {
      setOpeningPortal(false);
    }
  };

  const openNewSub = async () => {
    setShowNewSub(true);
    // Lazy-load prices the first time the modal opens
    if (prices || pricesLoading) return;
    setPricesLoading(true);
    setPricesError(null);
    try {
      const res = await fetch('/api/admin/stripe/products', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load prices');
      setPrices(json.prices || []);
    } catch (err) {
      setPricesError(err instanceof Error ? err.message : 'Failed to load prices');
    } finally {
      setPricesLoading(false);
    }
  };

  const startCheckout = async (priceId: string) => {
    setStartingCheckout(priceId);
    try {
      const res = await fetch(`/api/clients/${clientId}/subscriptions/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not start checkout');
      window.open(json.url, '_blank', 'noopener,noreferrer');
      setShowNewSub(false);
      toast.success('Checkout opened in a new tab. Subscription will appear here once the client completes payment.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setStartingCheckout(null);
    }
  };

  if (loading) {
    return (
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Subscriptions</h2>
        <p className="text-sm text-slate-500">Loading...</p>
      </section>
    );
  }

  if (!data) return null;

  const empty = data.active.length === 0 && data.pending.length === 0;
  const hasPortal = !!data.client.stripeCustomerId;

  return (
    <section className="rounded-lg border p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h2 className="font-semibold">Subscriptions</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openNewSub}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors bg-[#ffc312] hover:bg-[#e6ad0f]"
            title="Create a new subscription via Stripe Checkout"
          >
            + New Subscription
          </button>
          {hasPortal && (
            <button
              onClick={handleOpenPortal}
              disabled={openingPortal}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              title="Open Stripe Customer Portal for this client"
            >
              {openingPortal ? 'Opening...' : 'Manage billing in Stripe →'}
            </button>
          )}
        </div>
      </div>

      {empty && (
        <p className="text-sm text-slate-500">
          No active or scheduled subscriptions for this client.
        </p>
      )}

      {data.active.length > 0 && (
        <div className="space-y-2 mb-4">
          {data.active.map((sub) => {
            const badge = statusBadge(sub.status, sub.cancel_at_period_end);
            return (
              <div key={sub.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 truncate">
                        {sub.product_name || 'Subscription'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">
                      {formatMoney(sub.amount_cents, sub.currency)}
                      {sub.amount_cents !== null && (
                        <span className="text-slate-400"> {formatInterval(sub.interval, sub.interval_count)}</span>
                      )}
                      {sub.current_period_end && (
                        <>
                          <span className="mx-2 text-slate-300">·</span>
                          Next bill {formatDate(sub.current_period_end)}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {sub.cancel_at_period_end ? (
                      <button
                        onClick={() => handleToggleCancel(sub, false)}
                        disabled={busy === sub.id}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        {busy === sub.id ? 'Working...' : 'Resume billing'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleCancel(sub, true)}
                        disabled={busy === sub.id}
                        className="rounded-lg border border-red-200 text-red-700 px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50"
                      >
                        {busy === sub.id ? 'Working...' : 'Cancel at period end'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Scheduled (not started)
          </h3>
          {data.pending.map((sched) => {
            const badge = statusBadge(sched.status);
            return (
              <div key={sched.id} className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900 truncate">
                    {sched.product_name || 'Scheduled subscription'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="text-sm text-slate-600 mt-0.5">
                  {formatMoney(sched.amount_cents, sched.currency)}
                  {sched.amount_cents !== null && (
                    <span className="text-slate-400"> {formatInterval(sched.interval, sched.interval_count)}</span>
                  )}
                  {sched.starts_at && (
                    <>
                      <span className="mx-2 text-slate-300">·</span>
                      Starts {formatDate(sched.starts_at)}
                    </>
                  )}
                </div>
                {sched.end_behavior === 'cancel' && sched.ends_at && (
                  <p className="text-xs text-amber-700 mt-1">
                    ⚠️ Set to cancel after {formatDate(sched.ends_at)} — billing will stop unless updated in Stripe.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data.history.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
            View canceled history ({data.history.length})
          </summary>
          <div className="space-y-2 mt-2">
            {data.history.map((sub) => {
              const badge = statusBadge(sub.status);
              return (
                <div key={sub.id} className="rounded-lg border border-slate-200 p-3 opacity-75">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-700 truncate">
                      {sub.product_name || 'Subscription'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {formatMoney(sub.amount_cents, sub.currency)}
                    <span className="text-slate-400"> {formatInterval(sub.interval, null)}</span>
                    {sub.canceled_at && (
                      <>
                        <span className="mx-2 text-slate-300">·</span>
                        Canceled {formatDate(sub.canceled_at)}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {showNewSub && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewSub(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">New subscription</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pick a price. Stripe Checkout opens in a new tab.
                </p>
              </div>
              <button
                onClick={() => setShowNewSub(false)}
                className="text-slate-400 hover:text-slate-600"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {pricesLoading && (
                <p className="text-sm text-slate-500 text-center py-6">Loading prices from Stripe...</p>
              )}
              {pricesError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {pricesError}
                </div>
              )}
              {!pricesLoading && !pricesError && prices && prices.length === 0 && (
                <div className="text-sm text-slate-600 text-center py-4">
                  No active recurring prices found in Stripe. Create a product with a recurring
                  price at{' '}
                  <a
                    href="https://dashboard.stripe.com/products"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    dashboard.stripe.com/products
                  </a>
                  , then come back.
                </div>
              )}
              {!pricesLoading && !pricesError && prices && prices.length > 0 && (
                <div className="space-y-2">
                  {prices.map((p) => (
                    <button
                      key={p.priceId}
                      onClick={() => startCheckout(p.priceId)}
                      disabled={startingCheckout !== null}
                      className="w-full text-left flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 truncate">{p.productName}</div>
                        {p.nickname && (
                          <div className="text-xs text-slate-500 truncate">{p.nickname}</div>
                        )}
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <div className="font-semibold text-slate-900">
                          {formatMoney(p.amountCents, p.currency)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatInterval(p.interval, p.intervalCount).trim()}
                        </div>
                      </div>
                      {startingCheckout === p.priceId && (
                        <div className="ml-3 text-xs text-slate-500">Opening...</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
