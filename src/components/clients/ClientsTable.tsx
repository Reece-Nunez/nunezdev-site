'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stageToProgress } from '@/lib/progress';
import { currency } from '@/lib/ui';
import { formatPhoneUS, telHref } from '@/lib/phone';
import { useToast } from '@/components/ui/Toast';
import type { ClientOverview } from '@/types/clients';

type SortKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'company'
  | 'stage'
  | 'invoiced'
  | 'paid'
  | 'due'
  | 'last';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'All' | 'Lead' | 'Prospect' | 'Active' | 'Past';
type BalanceFilter = 'all' | 'due' | 'paid_up';

const PAGE_SIZE = 25;

const STATUS_BADGE: Record<string, string> = {
  Lead: 'bg-blue-50 text-blue-700 border-blue-200',
  Prospect: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Past: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function ClientsTable({ rows, onClientDeleted }: { rows: ClientOverview[]; onClientDeleted?: () => void }) {
  const router = useRouter();
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const { showToast, ToastContainer } = useToast();

  // Table controls
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('last');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  // Count rows by status for the stats row.
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { All: 0, Lead: 0, Prospect: 0, Active: 0, Past: 0 };
    if (Array.isArray(rows)) {
      for (const r of rows) {
        counts.All += 1;
        if (r.status in counts) counts[r.status as StatusFilter] += 1;
      }
    }
    return counts;
  }, [rows]);

  // Filtered + sorted view of the full row set. Pagination is applied after.
  const visibleRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    const q = query.trim().toLowerCase();

    let out = rows.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (balanceFilter === 'due' && (r.balance_due_cents ?? 0) <= 0) return false;
      if (balanceFilter === 'paid_up' && (r.balance_due_cents ?? 0) > 0) return false;
      if (!q) return true;
      const hay = [
        r.name,
        r.email ?? '',
        r.phone ?? '',
        r.company ?? '',
        ...(r.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const cmpStr = (a: string | null | undefined, b: string | null | undefined) =>
      (a ?? '').localeCompare(b ?? '') * dir;
    const cmpNum = (a: number, b: number) => (a - b) * dir;

    out = [...out].sort((a, b) => {
      switch (sortKey) {
        case 'name': return cmpStr(a.name, b.name);
        case 'email': return cmpStr(a.email, b.email);
        case 'phone': return cmpStr(a.phone, b.phone);
        case 'company': return cmpStr(a.company, b.company);
        case 'stage': return cmpStr(a.current_stage, b.current_stage);
        case 'invoiced': return cmpNum(a.total_invoiced_cents ?? 0, b.total_invoiced_cents ?? 0);
        case 'paid': return cmpNum(a.total_paid_cents ?? 0, b.total_paid_cents ?? 0);
        case 'due': return cmpNum(a.balance_due_cents ?? 0, b.balance_due_cents ?? 0);
        case 'last': {
          const at = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
          const bt = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
          return cmpNum(at, bt);
        }
        default: return 0;
      }
    });

    return out;
  }, [rows, query, statusFilter, balanceFilter, sortKey, sortDir]);

  // Totals reflect what's currently *visible* — so when you filter, the
  // numbers up top recalculate to match. That matches what most CRMs do.
  const totals = useMemo(() => {
    const t = { invoiced: 0, paid: 0, due: 0 };
    for (const r of visibleRows) {
      t.invoiced += r.total_invoiced_cents ?? 0;
      t.paid += r.total_paid_cents ?? 0;
      t.due += r.balance_due_cents ?? 0;
    }
    return t;
  }, [visibleRows]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  // Clamp page if filters reduced the total.
  const safePage = Math.min(page, totalPages);
  const pagedRows = visibleRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Sensible default direction per column type.
      setSortDir(['invoiced', 'paid', 'due', 'last'].includes(key) ? 'desc' : 'asc');
    }
    setPage(1);
  }

  function resetFilters() {
    setQuery('');
    setStatusFilter('All');
    setBalanceFilter('all');
    setPage(1);
  }

  function exportCsv() {
    if (visibleRows.length === 0) {
      showToast('No rows to export', 'error');
      return;
    }
    const headers = [
      'Name', 'Email', 'Phone', 'Company', 'Status', 'Stage',
      'Invoiced', 'Paid', 'Balance Due', 'Last Activity', 'Tags',
    ];
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      // RFC 4180 quoting
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(','),
      ...visibleRows.map((r) => [
        r.name,
        r.email ?? '',
        formatPhoneUS(r.phone),
        r.company ?? '',
        r.status,
        r.current_stage ?? '',
        ((r.total_invoiced_cents ?? 0) / 100).toFixed(2),
        ((r.total_paid_cents ?? 0) / 100).toFixed(2),
        ((r.balance_due_cents ?? 0) / 100).toFixed(2),
        r.last_activity_at ?? '',
        (r.tags ?? []).join('; '),
      ].map(esc).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${visibleRows.length} client(s)`, 'success');
  }

  const handleEdit = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}`);
  };

  const handleDeleteClick = (client: ClientOverview) => {
    setDeleteConfirm({ id: client.id, name: client.name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    setDeletingClient(deleteConfirm.id);
    try {
      const response = await fetch(`/api/clients/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete client');
      }

      // Close modal and refresh the list
      setDeleteConfirm(null);
      onClientDeleted?.();

    } catch (error) {
      console.error('Failed to delete client:', error);
      showToast(error instanceof Error ? error.message : 'Failed to delete client', 'error');
    } finally {
      setDeletingClient(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedClients.size === 0) {
      showToast('No clients selected', 'error');
      return;
    }
    setBulkDeleteConfirm(true);
  };

  const handleBulkDeleteConfirm = async () => {
    setBulkDeleting(true);
    setBulkDeleteConfirm(false);

    try {
      const deletePromises = Array.from(selectedClients).map(clientId =>
        fetch(`/api/clients/${clientId}`, { method: 'DELETE' })
      );

      const results = await Promise.allSettled(deletePromises);

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      setSelectedClients(new Set());
      onClientDeleted?.();

      if (successful > 0) {
        showToast(`${successful} client(s) deleted successfully`, 'success');
      }
      if (failed > 0) {
        showToast(`${failed} client(s) failed to delete`, 'error');
      }
    } catch (error) {
      console.error('Error deleting clients:', error);
      showToast('Failed to delete clients', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(clientId)) {
        newSelection.delete(clientId);
      } else {
        newSelection.add(clientId);
      }
      return newSelection;
    });
  };

  // Select-all toggles selection on the *currently paged* rows so users don't
  // accidentally bulk-delete clients they can't see.
  const toggleSelectAll = () => {
    setSelectedClients(prev => {
      const pageIds = pagedRows.map((r) => r.id);
      const allOnPageSelected = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  };

  const allOnPageSelected =
    pagedRows.length > 0 && pagedRows.every((r) => selectedClients.has(r.id));

  return (
    <>
      <ToastContainer />
      <div className="w-full min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-3 max-w-full">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 min-w-0 truncate">Clients</h1>
            {selectedClients.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedClients.size} selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="rounded-lg border border-red-300 px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-red-50 disabled:opacity-60 text-red-700 text-xs sm:text-sm whitespace-nowrap"
                >
                  {bulkDeleting ? 'Deleting…' : `Delete ${selectedClients.size}`}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={exportCsv}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 whitespace-nowrap"
              title="Export filtered rows to CSV"
            >
              Export CSV
            </button>
            <Link
              href="/dashboard/clients/new"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-white hover:opacity-90 text-sm whitespace-nowrap"
            >
              + New
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full min-w-0">
          <div className="rounded-xl border bg-white p-3 shadow-sm min-w-0">
            <div className="text-xs text-gray-600">Clients</div>
            <div className="text-base font-bold text-gray-900 truncate">{statusCounts.All}</div>
            <div className="text-[10px] text-gray-500 truncate">
              {statusCounts.Active} active · {statusCounts.Lead} leads
            </div>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-sm min-w-0">
            <div className="text-xs text-gray-600">Total Invoiced</div>
            <div className="text-base font-bold text-blue-600 truncate">{currency(totals.invoiced)}</div>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-sm min-w-0">
            <div className="text-xs text-gray-600">Total Paid</div>
            <div className="text-base font-bold text-green-600 truncate">{currency(totals.paid)}</div>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-sm min-w-0">
            <div className="text-xs text-gray-600">Amount Due</div>
            <div className="text-base font-bold text-red-600 truncate">{currency(totals.due)}</div>
          </div>
        </div>

        {/* Filter toolbar */}
        <div className="rounded-xl border bg-white p-3 shadow-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search name, email, phone, company, tags…"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="All">All statuses ({statusCounts.All})</option>
            <option value="Lead">Lead ({statusCounts.Lead})</option>
            <option value="Prospect">Prospect ({statusCounts.Prospect})</option>
            <option value="Active">Active ({statusCounts.Active})</option>
            <option value="Past">Past ({statusCounts.Past})</option>
          </select>
          <select
            value={balanceFilter}
            onChange={(e) => { setBalanceFilter(e.target.value as BalanceFilter); setPage(1); }}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="all">All balances</option>
            <option value="due">Has balance due</option>
            <option value="paid_up">Paid up</option>
          </select>
          {(query || statusFilter !== 'All' || balanceFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Reset
            </button>
          )}
          <div className="text-xs text-gray-500 sm:ml-auto whitespace-nowrap">
            Showing {visibleRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}
            –{Math.min(safePage * PAGE_SIZE, visibleRows.length)} of {visibleRows.length}
          </div>
        </div>

      {/* Mobile Cards - visible on small screens */}
      <div className="lg:hidden w-full min-w-0 space-y-3">
        {pagedRows.length > 0 ? pagedRows.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border shadow-sm p-3 w-full min-w-0">
            <div className="flex items-start justify-between mb-2 gap-2 w-full min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={selectedClients.has(r.id)}
                  onChange={() => toggleClientSelection(r.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link href={`/dashboard/clients/${r.id}`} className="font-medium text-blue-600 hover:underline text-sm truncate">
                      {r.name}
                    </Link>
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0 ${STATUS_BADGE[r.status] ?? 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 truncate">
                    {r.company ?? '—'}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEdit(r.id)}
                  className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(r)}
                  disabled={deletingClient === r.id}
                  className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                >
                  Del
                </button>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between w-full min-w-0">
                <span className="text-gray-600 flex-shrink-0">Email:</span>
                {r.email ? (
                  <a href={`mailto:${r.email}`} className="truncate ml-1 min-w-0 text-blue-600 hover:underline">{r.email}</a>
                ) : (
                  <span className="truncate ml-1 min-w-0">—</span>
                )}
              </div>
              <div className="flex justify-between w-full min-w-0">
                <span className="text-gray-600 flex-shrink-0">Phone:</span>
                {r.phone ? (
                  <a href={telHref(r.phone) ?? '#'} className="truncate ml-1 min-w-0 text-blue-600 hover:underline">{formatPhoneUS(r.phone)}</a>
                ) : (
                  <span className="truncate ml-1 min-w-0">—</span>
                )}
              </div>
              <div className="flex justify-between w-full min-w-0">
                <span className="text-gray-600 flex-shrink-0">Stage:</span>
                <span className="truncate ml-1 min-w-0">{r.current_stage ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center w-full">
                <span className="text-gray-600 flex-shrink-0">Progress:</span>
                <div className="h-1.5 w-12 rounded bg-gray-100 flex-shrink-0">
                  <div
                    className="h-1.5 rounded bg-emerald-500"
                    style={{ width: `${stageToProgress(r.current_stage)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-gray-100 text-center">
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Invoiced</div>
                <div className="font-medium text-blue-600 text-xs truncate">{currency(r.total_invoiced_cents)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Paid</div>
                <div className="font-medium text-green-600 text-xs truncate">{currency(r.total_paid_cents)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Due</div>
                <div className="font-medium text-red-600 text-xs truncate">{currency(r.balance_due_cents)}</div>
              </div>
            </div>

            {r.last_activity_at && (
              <div className="text-xs text-gray-500 mt-1 truncate">
                Last: {new Date(r.last_activity_at).toLocaleDateString()}
              </div>
            )}
          </div>
        )) : (
          <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-gray-500 w-full">
            {rows.length === 0 ? 'No clients yet — click + New to add one.' : 'No clients match your filters.'}
          </div>
        )}
      </div>

      {/* Desktop Table - hidden on small screens */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 w-12">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  title="Select all on this page"
                />
              </th>
              <SortableHeader label="Client" sortKey="name" current={sortKey} dir={sortDir} onSort={changeSort} />
              <th className="px-3 py-2">Status</th>
              <SortableHeader label="Email" sortKey="email" current={sortKey} dir={sortDir} onSort={changeSort} />
              <SortableHeader label="Phone" sortKey="phone" current={sortKey} dir={sortDir} onSort={changeSort} />
              <SortableHeader label="Company" sortKey="company" current={sortKey} dir={sortDir} onSort={changeSort} />
              <SortableHeader label="Stage" sortKey="stage" current={sortKey} dir={sortDir} onSort={changeSort} />
              <SortableHeader label="Invoiced" sortKey="invoiced" current={sortKey} dir={sortDir} onSort={changeSort} align="right" />
              <SortableHeader label="Paid" sortKey="paid" current={sortKey} dir={sortDir} onSort={changeSort} align="right" />
              <SortableHeader label="Due" sortKey="due" current={sortKey} dir={sortDir} onSort={changeSort} align="right" />
              <SortableHeader label="Last activity" sortKey="last" current={sortKey} dir={sortDir} onSort={changeSort} />
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length > 0 ? pagedRows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50/50">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedClients.has(r.id)}
                    onChange={() => toggleClientSelection(r.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/dashboard/clients/${r.id}`} className="font-medium text-blue-600 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {r.email ? (
                    <a href={`mailto:${r.email}`} className="text-blue-600 hover:underline">{r.email}</a>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.phone ? (
                    <a href={telHref(r.phone) ?? '#'} className="text-blue-600 hover:underline">{formatPhoneUS(r.phone)}</a>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">{r.company ?? '—'}</td>
                <td className="px-3 py-2">{r.current_stage ?? '—'}</td>
                <td className="px-3 py-2 text-right">{currency(r.total_invoiced_cents)}</td>
                <td className="px-3 py-2 text-right">{currency(r.total_paid_cents)}</td>
                <td className="px-3 py-2 text-right">{currency(r.balance_due_cents)}</td>
                <td className="px-3 py-2">{r.last_activity_at ? new Date(r.last_activity_at).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleEdit(r.id)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => handleDeleteClick(r)}
                      disabled={deletingClient === r.id}
                      className="text-red-600 hover:underline text-sm disabled:opacity-50"
                    >
                      {deletingClient === r.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                  {rows.length === 0 ? 'No clients yet — click + New to add one.' : 'No clients match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-gray-500">
            Page {safePage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-red-600">Delete Client</h3>
            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              </p>
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                <strong>Warning:</strong> This will permanently delete:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All client information</li>
                  <li>All invoices and payments</li>
                  <li>All notes and tasks</li>
                </ul>
                <p className="mt-2"><strong>This action cannot be undone!</strong></p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deletingClient !== null}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingClient !== null}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingClient === deleteConfirm.id ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-red-600">Delete Multiple Clients</h3>
            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete <strong>{selectedClients.size} client(s)</strong>?
              </p>
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                <strong>Warning:</strong> This will permanently delete for ALL selected clients:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All client information</li>
                  <li>All invoices and payments</li>
                  <li>All notes and tasks</li>
                </ul>
                <p className="mt-2"><strong>This action cannot be undone!</strong></p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
                disabled={bulkDeleting}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedClients.size} Clients`}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

function SortableHeader({
  label, sortKey, current, dir, onSort, align,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: 'right';
}) {
  const active = current === sortKey;
  return (
    <th className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-gray-900 ${active ? 'text-gray-900 font-semibold' : 'text-gray-700 font-medium'}`}
      >
        <span>{label}</span>
        <span className="text-xs text-gray-400">
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
