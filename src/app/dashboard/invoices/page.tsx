'use client';

import useSWR, { useSWRConfig } from 'swr';
import { useMemo, useState, useCallback } from 'react';
import { InvoiceStatusBadge } from '@/components/ui/StatusBadge';
import InvoiceAnalytics from '@/components/invoices/InvoiceAnalytics';
import { useToast } from '@/components/ui/Toast';
import { useRealtimeEvents, RealtimeEvent } from '@/hooks/useRealtimeEvents';
import CombineInvoicesModal from '@/components/invoices/CombineInvoicesModal';

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
  client_id?: string;
  invoice_number?: string;
  title?: string;
  clients?: { id?: string; name?: string | null; email?: string | null } | null;
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
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-green-300 px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-green-50 disabled:opacity-60 text-green-700 text-xs sm:text-sm whitespace-nowrap"
      >
        {busy ? "Fixing…" : "Fix Client Financials"}
      </button>
      {msg && <span className="text-xs text-gray-600 hidden sm:inline">{msg}</span>}
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
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-blue-300 px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-blue-50 disabled:opacity-60 text-blue-700 text-xs sm:text-sm whitespace-nowrap"
      >
        {busy ? "Backfilling…" : "Backfill Stripe Payments"}
      </button>
      {msg && <span className="text-xs text-gray-600 hidden sm:inline">{msg}</span>}
    </div>
  );
}



export default function DashboardInvoices() {
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [deletingInvoice, setDeletingInvoice] = useState<string | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showCombineModal, setShowCombineModal] = useState(false);
  const [combineLoading, setCombineLoading] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const { showToast, ToastContainer } = useToast();

  const url = `/api/dashboard/invoices?status=${status}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(
    to
  )}&q=${encodeURIComponent(q)}`;

  const { data, isLoading } = useSWR<InvoicesResponse>(url, fetcher);
  const { mutate } = useSWRConfig(); // use SWR's global mutate
  const rows = useMemo(() => data?.invoices ?? [], [data]);

  // Real-time updates via SSE
  const handlePaymentEvent = useCallback((event: RealtimeEvent) => {
    const amount = event.event_data.amount_cents
      ? currency(event.event_data.amount_cents)
      : '';
    const clientName = event.event_data.client_name || 'A client';
    const label = event.event_data.installment_label || 'Payment';
    showToast(`${clientName}: ${label} of ${amount} received!`, 'success');
  }, [showToast]);

  useRealtimeEvents({
    onPaymentReceived: handlePaymentEvent,
    onInstallmentPaid: handlePaymentEvent,
    onRefresh: () => mutate(url),
    enabled: true,
  });

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

  const handleBulkDelete = async () => {
    if (selectedInvoices.size === 0) {
      showToast('No invoices selected', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedInvoices.size} invoice(s)? This action cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      const deletePromises = Array.from(selectedInvoices).map(invoiceId =>
        fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' })
      );

      const results = await Promise.allSettled(deletePromises);
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      // Clear selections
      setSelectedInvoices(new Set());
      
      // Refresh the invoices list
      mutate(url);
      
      // Show success/error messages
      if (successful > 0) {
        showToast(`${successful} invoice(s) deleted successfully`, 'success');
      }
      if (failed > 0) {
        showToast(`${failed} invoice(s) failed to delete`, 'error');
      }
    } catch (error) {
      console.error('Error deleting invoices:', error);
      showToast('Failed to delete invoices', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(invoiceId)) {
        newSelection.delete(invoiceId);
      } else {
        newSelection.add(invoiceId);
      }
      return newSelection;
    });
  };

  const toggleSelectAll = () => {
    setSelectedInvoices(prev => {
      if (prev.size === rows.length) {
        return new Set(); // Deselect all
      } else {
        return new Set(rows.map(r => r.id)); // Select all
      }
    });
  };

  // Get selected invoice objects for combine modal
  const selectedInvoicesList = useMemo(() => {
    return rows.filter(inv => selectedInvoices.has(inv.id));
  }, [rows, selectedInvoices]);

  // Check if we can combine (2+ invoices, all same client, not paid/void)
  const canCombine = useMemo(() => {
    if (selectedInvoices.size < 2) return false;
    const clientIds = new Set(
      selectedInvoicesList.map(inv => inv.client_id || inv.clients?.id)
    );
    if (clientIds.size !== 1) return false;
    // Check all are combinable status (not paid or void)
    return selectedInvoicesList.every(
      inv => inv.status !== 'paid' && inv.status !== 'void'
    );
  }, [selectedInvoices, selectedInvoicesList]);

  // Check if we can mark as paid (at least 1 invoice, not paid/void)
  const canMarkPaid = useMemo(() => {
    if (selectedInvoices.size === 0) return false;
    return selectedInvoicesList.every(
      inv => inv.status !== 'paid' && inv.status !== 'void'
    );
  }, [selectedInvoices, selectedInvoicesList]);

  // Handle combine invoices
  const handleCombineInvoices = async () => {
    setCombineLoading(true);
    try {
      const res = await fetch('/api/invoices/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_ids: Array.from(selectedInvoices),
          send_immediately: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to combine invoices');
      }

      setShowCombineModal(false);
      setSelectedInvoices(new Set());
      mutate(url);
      showToast(data.message || 'Invoices combined successfully', 'success');
    } catch (error) {
      console.error('Error combining invoices:', error);
      throw error;
    } finally {
      setCombineLoading(false);
    }
  };

  // Handle mark as paid
  const handleMarkPaid = async () => {
    if (!canMarkPaid) return;

    const confirmMsg = selectedInvoices.size === 1
      ? 'Mark this invoice as paid?'
      : `Mark ${selectedInvoices.size} invoices as paid?`;

    if (!confirm(confirmMsg)) return;

    setMarkingPaid(true);
    try {
      const res = await fetch('/api/invoices/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_ids: Array.from(selectedInvoices),
          payment_method: 'other',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to mark invoices as paid');
      }

      setSelectedInvoices(new Set());
      mutate(url);
      showToast(data.message || 'Invoices marked as paid', 'success');
    } catch (error) {
      console.error('Error marking invoices as paid:', error);
      showToast(error instanceof Error ? error.message : 'Failed to mark as paid', 'error');
    } finally {
      setMarkingPaid(false);
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

  return (
    <>
      <ToastContainer />
      <div className="px-3 py-4 sm:p-6 space-y-4 max-w-full min-w-0">
      <div className="flex items-center justify-between gap-3 max-w-full">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold min-w-0 truncate">Invoices</h1>
          {selectedInvoices.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedInvoices.size} selected
              </span>
              {canMarkPaid && (
                <button
                  onClick={handleMarkPaid}
                  disabled={markingPaid}
                  className="rounded-lg border border-emerald-300 px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-emerald-50 disabled:opacity-60 text-emerald-700 text-xs sm:text-sm whitespace-nowrap"
                >
                  {markingPaid ? 'Marking…' : 'Mark Paid'}
                </button>
              )}
              {canCombine && (
                <button
                  onClick={() => setShowCombineModal(true)}
                  className="rounded-lg border border-blue-300 px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-blue-50 text-blue-700 text-xs sm:text-sm whitespace-nowrap"
                >
                  Combine & Send
                </button>
              )}
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-lg border border-red-300 px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-red-50 disabled:opacity-60 text-red-700 text-xs sm:text-sm whitespace-nowrap"
              >
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedInvoices.size}`}
              </button>
            </div>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
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
            className="rounded-lg border px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-50 disabled:opacity-60 text-xs sm:text-sm whitespace-nowrap"
          >
            {relinking ? 'Relinking…' : 'Relink orphans'}
          </button>
          <FixClientFinancialsButton onDone={() => mutate(url)} />
          <BackfillStripeButton onDone={() => mutate(url)} />
        </div>
        <div className="sm:hidden flex-shrink-0">
          <a
            href="/dashboard/invoices/new"
            className="rounded-lg px-3 py-2 text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: '#ffc312' }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#e6ad0f'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#ffc312'}
          >
            + New
          </a>
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
      <div className="rounded-2xl border bg-white p-3 sm:p-4 space-y-3 w-full min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-sm min-w-0">
            <div className="text-gray-600">Status</div>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="draft">Draft</option>
              <option value="void">Void</option>
            </select>
          </label>
          <label className="text-sm min-w-0">
            <div className="text-gray-600">From</div>
            <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm min-w-0">
            <div className="text-gray-600">To</div>
            <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="text-sm min-w-0">
            <div className="text-gray-600">Client</div>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        
        {/* Mobile admin buttons */}
        <div className="sm:hidden flex flex-wrap gap-2">
          {selectedInvoices.size > 0 && (
            <>
              {canMarkPaid && (
                <button
                  onClick={handleMarkPaid}
                  disabled={markingPaid}
                  className="rounded-lg border border-emerald-300 px-2 py-1.5 hover:bg-emerald-50 disabled:opacity-60 text-emerald-700 text-xs whitespace-nowrap"
                >
                  {markingPaid ? 'Marking…' : 'Mark Paid'}
                </button>
              )}
              {canCombine && (
                <button
                  onClick={() => setShowCombineModal(true)}
                  className="rounded-lg border border-blue-300 px-2 py-1.5 hover:bg-blue-50 text-blue-700 text-xs whitespace-nowrap"
                >
                  Combine
                </button>
              )}
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-lg border border-red-300 px-2 py-1.5 hover:bg-red-50 disabled:opacity-60 text-red-700 text-xs whitespace-nowrap"
              >
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedInvoices.size}`}
              </button>
            </>
          )}
          <button
            onClick={relinkOrphans}
            disabled={relinking}
            className="rounded-lg border px-2 py-1.5 hover:bg-gray-50 disabled:opacity-60 text-xs whitespace-nowrap"
          >
            {relinking ? 'Relinking…' : 'Relink'}
          </button>
          <FixClientFinancialsButton onDone={() => mutate(url)} />
          <BackfillStripeButton onDone={() => mutate(url)} />
        </div>
      </div>

      {/* Mobile Cards - visible on small screens */}
      <div className="lg:hidden w-full min-w-0 space-y-3">
        {isLoading && (
          <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-gray-500">
            Loading…
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-gray-500">
            No invoices found.
          </div>
        )}

        {rows.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border shadow-sm p-3 w-full min-w-0">
            <div className="flex items-start justify-between mb-2 gap-2 w-full min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={selectedInvoices.has(r.id)}
                  onChange={() => toggleInvoiceSelection(r.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">
                    {r.clients?.name ? (
                      <a href={`/dashboard/invoices/${r.id}`} className="text-blue-600 hover:underline truncate block">
                        {r.clients.name}
                      </a>
                    ) : '—'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{r.clients?.email ?? ''}</div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <InvoiceStatusBadge status={r.status} />
              </div>
            </div>
            
            <div className="space-y-1 text-xs">
              <div className="flex justify-between w-full min-w-0">
                <span className="text-gray-600 flex-shrink-0">Amount:</span>
                <div className="min-w-0 text-right">
                  <div className="font-medium truncate">{currency(r.amount_cents)}</div>
                  {hasPartialPayments(r) && (
                    <div className="space-y-0.5">
                      <div className="text-emerald-600 truncate">
                        {currency(getTotalPaid(r))} paid
                      </div>
                      <div className="text-orange-600 font-medium truncate">
                        {currency(getRemainingBalance(r))} due
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between w-full min-w-0">
                <span className="text-gray-600 flex-shrink-0">Issued:</span>
                <span className="truncate ml-1 min-w-0">{r.issued_at ? new Date(r.issued_at).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex justify-between w-full min-w-0">
                <span className="text-gray-600 flex-shrink-0">Due:</span>
                <span className="truncate ml-1 min-w-0">{r.due_at ? new Date(r.due_at).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex justify-between w-full min-w-0">
                <span className="text-gray-600 flex-shrink-0">Signed:</span>
                <span className="truncate ml-1 min-w-0">{r.signed_at ? new Date(r.signed_at).toLocaleDateString() : '—'}</span>
              </div>
            </div>

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
              <div className="flex gap-2">
                <a
                  href={`/dashboard/invoices/${r.id}/edit`}
                  className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                >
                  Edit
                </a>
                <button
                  onClick={() => handleDeleteInvoice(r.id)}
                  disabled={deletingInvoice === r.id}
                  className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                >
                  {deletingInvoice === r.id ? '...' : 'Del'}
                </button>
              </div>
              <div className="flex gap-2 text-xs">
                {r.stripe_invoice_id && (
                  <a
                    className="text-blue-600 hover:underline"
                    href={`https://dashboard.stripe.com/invoices/${r.stripe_invoice_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Stripe
                  </a>
                )}
                {!r.signed_at && r.hosted_invoice_url && (
                  <a className="text-emerald-700 hover:underline" href={`/invoices/${r.id}/agreement`}>
                    Sign
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table - hidden on small screens */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 w-12">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedInvoices.size === rows.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
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
                <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}

            {!isLoading && rows.length === 0 && (
              <tr className="border-t">
                <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                  No invoices found.
                </td>
              </tr>
            )}

            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedInvoices.has(r.id)}
                    onChange={() => toggleInvoiceSelection(r.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {r.clients?.name ? (
                      <a href={`/dashboard/invoices/${r.id}`} className="text-blue-600 hover:underline">
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
                      href={`/dashboard/invoices/${r.id}/edit`}
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

    {/* Combine Invoices Modal */}
    {showCombineModal && (
      <CombineInvoicesModal
        invoices={selectedInvoicesList.map(inv => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          title: inv.title,
          amount_cents: inv.amount_cents || 0,
          status: inv.status,
          issued_at: inv.issued_at || undefined,
          clients: inv.clients ? {
            id: inv.clients.id || '',
            name: inv.clients.name || '',
            email: inv.clients.email || '',
          } : undefined,
        }))}
        onConfirm={handleCombineInvoices}
        onCancel={() => setShowCombineModal(false)}
        loading={combineLoading}
      />
    )}
    </>
  );
}
