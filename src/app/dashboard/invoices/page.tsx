'use client';

import useSWR, { useSWRConfig } from 'swr';
import { useMemo, useState } from 'react';
import { InvoiceStatusBadge } from '@/components/ui/StatusBadge';
import InvoiceAnalytics from '@/components/invoices/InvoiceAnalytics';
import { useToast } from '@/components/ui/Toast';

const fetcher = (u: string) => fetch(u).then(r => r.json());
const currency = (cents?: number | null) =>
  ((cents ?? 0) / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

// Helper functions for payment calculations
const getTotalPaid = (invoice: Invoice) => {
  return (invoice.invoice_payments || []).reduce((sum, payment) => sum + payment.amount_cents, 0);
};

const getRemainingBalance = (invoice: Invoice) => {
  const totalPaid = getTotalPaid(invoice);
  return Math.max(0, (invoice.amount_cents || 0) - totalPaid);
};

const hasPartialPayments = (invoice: Invoice) => {
  const totalPaid = getTotalPaid(invoice);
  return totalPaid > 0 && totalPaid < (invoice.amount_cents || 0);
};

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void' | 'overdue' | 'partially paid';

interface Invoice {
  id: string;
  clients?: { name?: string | null; email?: string | null } | null;
  status: InvoiceStatus | string;
  amount_cents: number | null;
  issued_at?: string | null;
  due_at?: string | null;
  stripe_invoice_id?: string | null;
  signed_at?: string | null;
  hosted_invoice_url?: string | null;
  invoice_payments?: Array<{
    amount_cents: number;
    payment_method: string;
    paid_at: string;
  }>;
}

interface InvoicesResponse {
  invoices?: Invoice[];
}

interface BackfillResponse {
  scanned?: number;
  upserts?: number;
  createdClients?: number;
}


function FixClientFinancialsButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/database/fix-client-financials', { method: 'POST' });
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'Database fix failed');
      }
      
      setMsg("Client financials view updated for partial payments!");
      onDone();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Database fix failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-green-300 px-3 py-2 hover:bg-green-50 disabled:opacity-60 text-green-700"
      >
        {busy ? "Fixing…" : "Fix Client Financials"}
      </button>
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
    </div>
  );
}


function BackfillStripeButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function apiJson(url: string) {
    const res = await fetch(url);
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try { data = JSON.parse(text); } 
      catch { throw new Error(`Bad JSON from ${url}: ${text.slice(0,200)}`); }
    }
    if (!res.ok) throw new Error((data as { error?: string })?.error || `${res.status} ${res.statusText}`);
    return data;
  }

  async function run() {
    setBusy(true); setMsg(null);
    try {
      // First run dry to see what would be matched
      const dryRun = await apiJson("/api/stripe/backfill/payments?limit=100&dry=true") as any;
      
      if (dryRun?.summary?.matched === 0) {
        setMsg("No matching payments found to backfill.");
        return;
      }

      // Run actual backfill
      const result = await apiJson("/api/stripe/backfill/payments?limit=100&dry=false") as any;
      
      setMsg(
        `Stripe backfill: ${result?.summary?.matched ?? 0} matched, ` +
        `${result?.summary?.added ?? 0} payments added, ` +
        `${result?.summary?.skipped ?? 0} skipped.`
      );
      onDone();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Stripe backfill failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-blue-300 px-3 py-2 hover:bg-blue-50 disabled:opacity-60 text-blue-700"
      >
        {busy ? "Backfilling…" : "Backfill Stripe Payments"}
      </button>
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
    </div>
  );
}



export default function DashboardInvoices() {
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [deletingInvoice, setDeletingInvoice] = useState<string | null>(null);
  const { showToast, ToastContainer } = useToast();

  const url = `/api/dashboard/invoices?status=${status}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(
    to
  )}&q=${encodeURIComponent(q)}`;

  const { data, isLoading } = useSWR<InvoicesResponse>(url, fetcher);
  const { mutate } = useSWRConfig(); // use SWR's global mutate

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    setDeletingInvoice(invoiceId);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete invoice');
      }

      // Refresh the invoices list
      mutate(url);
      
      // Show success toast
      showToast('Invoice deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showToast(error instanceof Error ? error.message : 'Failed to delete invoice', 'error');
    } finally {
      setDeletingInvoice(null);
    }
  };

  // Relink orphans summary state
  const [relinking, setRelinking] = useState(false);
  const [relinkSummary, setRelinkSummary] = useState<null | {
    scanned: number; updated: number; matched_by_meta: number;
    matched_by_email: number; already_linked: number; no_stripe_id: number;
    stripe_fetch_failed: number; skipped_no_match: number;
  }>(null);

  async function relinkOrphans() {
    setRelinking(true);
    try {
      const res = await fetch('/api/invoices/relink?adopt=1&limit=200', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Relink failed');
      setRelinkSummary(json.summary);
      mutate(url); // refresh the list
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert(e.message);
      } else {
        alert('Relink failed');
      }
    } finally {
      setRelinking(false);
    }
  }

  const rows = useMemo(() => data?.invoices ?? [], [data]);

  return (
    <>
      <ToastContainer />
      <div className="space-y-4 my-36">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard/invoices/new"
            className="rounded-lg px-4 py-2 text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: '#ffc312' }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#e6ad0f'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#ffc312'}
          >
            + New Invoice
          </a>
          <button
            onClick={relinkOrphans}
            disabled={relinking}
            className="rounded-lg border px-3 py-2 hover:bg-gray-50 disabled:opacity-60 text-sm"
          >
            {relinking ? 'Relinking…' : 'Relink orphans'}
          </button>
          <FixClientFinancialsButton onDone={() => mutate(url)} />
          <BackfillStripeButton onDone={() => mutate(url)} />
        </div>
      </div>

      {relinkSummary && (
        <div className="text-xs text-gray-600">
          Scanned: <b>{relinkSummary.scanned}</b> · Updated: <b>{relinkSummary.updated}</b> ·
          Meta matches: <b>{relinkSummary.matched_by_meta}</b> · Email matches: <b>{relinkSummary.matched_by_email}</b> ·
          Already linked: <b>{relinkSummary.already_linked}</b> · No Stripe ID: <b>{relinkSummary.no_stripe_id}</b> ·
          Stripe fetch failed: <b>{relinkSummary.stripe_fetch_failed}</b> · No match: <b>{relinkSummary.skipped_no_match}</b>
        </div>
      )}

      {/* Analytics */}
      <InvoiceAnalytics invoices={rows as any} />

      {/* Filters */}
      <div className="rounded-2xl border bg-white p-4 flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          <div className="text-gray-600">Status</div>
          <select className="rounded-lg border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="overdue">Overdue</option>
            <option value="draft">Draft</option>
            <option value="void">Void</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="text-gray-600">From</div>
          <input type="date" className="rounded-lg border px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="text-gray-600">To</div>
          <input type="date" className="rounded-lg border px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-sm flex-1 min-w-[220px]">
          <div className="text-gray-600">Client</div>
          <input className="w-full rounded-lg border px-3 py-2" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Issued</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Signed</th>
              <th className="px-3 py-2">Stripe</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr className="border-t">
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}

            {!isLoading && rows.length === 0 && (
              <tr className="border-t">
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  No invoices found.
                </td>
              </tr>
            )}

            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {r.clients?.name ? (
                      <a href={`/invoices/${r.id}`} className="text-blue-600 hover:underline">
                        {r.clients.name}
                      </a>
                    ) : '—'}
                  </div>
                  <div className="text-xs text-gray-500">{r.clients?.email ?? ''}</div>
                </td>
                <td className="px-3 py-2">
                  <InvoiceStatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <div>
                    {currency(r.amount_cents)}
                    {hasPartialPayments(r) && (
                      <div className="text-xs space-y-0.5 mt-1">
                        <div className="text-emerald-600">
                          {currency(getTotalPaid(r))} paid
                        </div>
                        <div className="text-orange-600 font-medium">
                          {currency(getRemainingBalance(r))} due
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">{r.issued_at ? new Date(r.issued_at).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2">{r.due_at ? new Date(r.due_at).toLocaleDateString() : '—'}</td>

                {/* Signed column */}
                <td className="px-3 py-2">
                  {r.signed_at ? new Date(r.signed_at).toLocaleDateString() : '—'}
                  {!r.signed_at && r.hosted_invoice_url && (
                    <a className="ml-3 text-emerald-700 hover:underline" href={`/invoices/${r.id}/agreement`}>
                      Sign
                    </a>
                  )}
                </td>

                {/* Stripe column */}
                <td className="px-3 py-2">
                  {r.stripe_invoice_id ? (
                    <a
                      className="text-blue-600 hover:underline"
                      href={`https://dashboard.stripe.com/invoices/${r.stripe_invoice_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  ) : '—'}
                </td>

                {/* Actions column */}
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <a
                      href={`/invoices/${r.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="Edit Invoice"
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleDeleteInvoice(r.id)}
                      disabled={deletingInvoice === r.id}
                      className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Invoice"
                    >
                      {deletingInvoice === r.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
