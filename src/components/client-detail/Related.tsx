'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { DealLite, InvoiceLite } from '@/types/client_detail';
import { currency, prettyDate } from '@/lib/ui';
import { InvoiceStatusBadge, DealStageBadge } from '@/components/ui/StatusBadge';
import EditInvoice from './EditInvoice';

export function ClientDeals({ clientId }: { clientId: string }) {
  const { data } = useSWR<{ deals: DealLite[] }>(`/api/clients/${clientId}/deals`, (u: string) => fetch(u).then(r => r.json()));
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Deals</h2>
        <a href="/deals" className="text-sm text-blue-600 hover:underline">Open pipeline</a>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr><th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2 text-center">Stage</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2 text-center">Created</th></tr></thead>
          <tbody>
            {data?.deals?.map(d => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2">{d.title}</td>
                <td className="px-3 py-2 text-center"><DealStageBadge status={d.stage} /></td>
                <td className="px-3 py-2 text-right">{currency(d.value_cents)}</td>
                <td className="px-3 py-2 text-center">{prettyDate(d.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ClientInvoices({ clientId }: { clientId: string }) {
  const { data, mutate } = useSWR<{ invoices: InvoiceLite[] }>(`/api/clients/${clientId}/invoices`, (u: string) => fetch(u as string).then(r => r.json()));
  const [editingInvoice, setEditingInvoice] = useState<InvoiceLite | null>(null);

  const handleInvoiceUpdated = () => {
    mutate(); // Refresh the invoices list
    setEditingInvoice(null);
  };

  return (
    <>
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invoices</h2>
          <a href="/invoices" className="text-sm text-blue-600 hover:underline">Open invoices</a>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-center">Issued</th><th className="px-3 py-2 text-center">Due</th><th className="px-3 py-2 text-center">Actions</th></tr></thead>
            <tbody>
              {data?.invoices?.map(inv => (
                <tr key={inv.id} className="border-t">
                  <td className="px-3 py-2 text-center"><InvoiceStatusBadge status={inv.status} /></td>
                  <td className="px-3 py-2 text-right">{currency(inv.amount_cents)}</td>
                  <td className="px-3 py-2 text-center">{prettyDate(inv.issued_at)}</td>
                  <td className="px-3 py-2 text-center">{prettyDate(inv.due_at)}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => setEditingInvoice(inv)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingInvoice && (
        <EditInvoice
          invoice={editingInvoice}
          onUpdated={handleInvoiceUpdated}
          onCancel={() => setEditingInvoice(null)}
        />
      )}
    </>
  );
}
