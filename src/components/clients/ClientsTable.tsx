'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stageToProgress, currency } from '@/lib/progress';
import { useToast } from '@/components/ui/Toast';
import type { ClientOverview } from '@/types/clients';

export default function ClientsTable({ rows, onClientDeleted }: { rows: ClientOverview[]; onClientDeleted?: () => void }) {
  const router = useRouter();
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const { showToast, ToastContainer } = useToast();
  
  const totals = useMemo(() => {
    const t = { invoiced: 0, paid: 0, due: 0 };
    if (Array.isArray(rows)) {
      for (const r of rows) {
        t.invoiced += r.total_invoiced_cents ?? 0;
        t.paid += r.total_paid_cents ?? 0;
        t.due += r.balance_due_cents ?? 0;
        // t.draft += r.draft_invoiced_cents ?? 0;
      }
    }
    return t;
  }, [rows]);

  const handleEdit = (clientId: string) => {
    router.push(`/clients/${clientId}`);
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
      alert(error instanceof Error ? error.message : 'Failed to delete client');
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

  const toggleSelectAll = () => {
    setSelectedClients(prev => {
      if (prev.size === rows.length) {
        return new Set();
      } else {
        return new Set(rows.map(r => r.id));
      }
    });
  };

  return (
    <>
      <ToastContainer />
      <div className="w-full min-w-0 space-y-3">
        {/* Header */}
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
          <Link
            href="/dashboard/clients/new"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-white hover:opacity-90 text-sm whitespace-nowrap flex-shrink-0"
          >
            + New
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0">
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

      {/* Mobile Cards - visible on small screens */}
      <div className="lg:hidden w-full min-w-0 space-y-3">
        {Array.isArray(rows) ? rows.map((r) => (
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
                  <Link href={`/clients/${r.id}`} className="font-medium text-blue-600 hover:underline text-sm block truncate">
                    {r.name}
                  </Link>
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
                <span className="truncate ml-1 min-w-0">{r.email ?? '—'}</span>
              </div>
              <div className="flex justify-between w-full min-w-0">
                <span className="text-gray-600 flex-shrink-0">Phone:</span>
                <span className="truncate ml-1 min-w-0">{r.phone ?? '—'}</span>
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
            No clients found
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
                  checked={Array.isArray(rows) && rows.length > 0 && selectedClients.size === rows.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2 text-right">Invoiced</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Due</th>
              <th className="px-3 py-2">Last activity</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(rows) ? rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedClients.has(r.id)}
                    onChange={() => toggleClientSelection(r.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/clients/${r.id}`} className="font-medium text-blue-600 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.email ?? '—'}</td>
                <td className="px-3 py-2">{r.phone ?? '—'}</td>
                <td className="px-3 py-2">{r.company ?? '—'}</td>
                <td className="px-3 py-2">{r.current_stage ?? '—'}</td>
                <td className="px-3 py-2">
                  <div className="h-2 w-28 rounded bg-gray-100">
                    <div
                      className="h-2 rounded bg-emerald-500"
                      style={{ width: `${stageToProgress(r.current_stage)}%` }}
                    />
                  </div>
                </td>
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
                  No clients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
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

      {/* Bulk Delete Confirmation Modal */}
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
