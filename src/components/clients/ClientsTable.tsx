'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stageToProgress, currency } from '@/lib/progress';
import type { ClientOverview } from '@/types/clients';

export default function ClientsTable({ rows, onClientDeleted }: { rows: ClientOverview[]; onClientDeleted?: () => void }) {
  const router = useRouter();
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  
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

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="text-sm text-gray-600">Totals</div>
        <div className="mt-1 flex gap-6 text-sm">
          <div>Invoiced: <strong>{currency(totals.invoiced)}</strong></div>
          <div>Paid: <strong>{currency(totals.paid)}</strong></div>
          <div>Due: <strong>{currency(totals.due)}</strong></div>
          {/* <div>Draft: <strong>{currency(totals.draft)}</strong></div> */}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2 text-right">Invoiced</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Due</th>
              {/* <th className="px-3 py-2 text-right">Draft</th> */}
              <th className="px-3 py-2">Last activity</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(rows) ? rows.map((r) => (
              <tr key={r.id} className="border-t">
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
                {/* <td className="px-3 py-2 text-right">{currency(r.draft_invoiced_cents)}</td> */}
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
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
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
                  <li>All deals associated with this client</li>
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
    </div>
  );
}
