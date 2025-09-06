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

interface PaymentDetail {
  id: string;
  amount_cents: number;
  paid_at: string;
  payment_method?: string;
  stripe_payment_intent_id?: string;
  metadata?: any;
}

interface InvoiceWithPayments extends InvoiceLite {
  invoice_payments?: PaymentDetail[];
}

interface InvoiceData {
  invoices: InvoiceWithPayments[];
  financials: {
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
  };
}

export function ClientInvoices({ clientId }: { clientId: string }) {
  const { data, mutate } = useSWR<InvoiceData>(`/api/clients/${clientId}/invoices`, (u: string) => fetch(u as string).then(r => r.json()));
  const [editingInvoice, setEditingInvoice] = useState<InvoiceLite | null>(null);

  const handleInvoiceUpdated = () => {
    mutate(); // Refresh the invoices list
    setEditingInvoice(null);
  };

  return (
    <>
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invoices & Payments</h2>
          <a href="/invoices" className="text-sm text-blue-600 hover:underline">Open invoices</a>
        </div>
        
        {/* Financial Summary */}
        {data?.financials && (
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-gray-600">Total Invoiced</div>
              <div className="text-lg font-semibold">{currency(data.financials.totalInvoiced)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Total Paid</div>
              <div className="text-lg font-semibold text-green-600">{currency(data.financials.totalPaid)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Balance Due</div>
              <div className="text-lg font-semibold text-red-600">{currency(data.financials.balanceDue)}</div>
            </div>
          </div>
        )}

        {/* Invoice List with Payment Details */}
        {data?.invoices && data.invoices.length > 0 ? (
          <div className="space-y-4">
            {data.invoices.map((invoice) => (
              <div key={invoice.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{currency(invoice.amount_cents)}</span>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-500">
                      {invoice.issued_at ? prettyDate(invoice.issued_at) : 'Draft'}
                    </div>
                    <button
                      onClick={() => setEditingInvoice(invoice)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                
                {invoice.description && (
                  <p className="text-sm text-gray-600 mb-2">{invoice.description}</p>
                )}
                
                {invoice.invoice_payments && invoice.invoice_payments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-sm font-medium text-gray-700">Payments:</div>
                    {invoice.invoice_payments.map((payment) => (
                      <div key={payment.id} className="text-sm text-gray-600 flex items-center justify-between bg-gray-50 px-2 py-1 rounded">
                        <span>{currency(payment.amount_cents)} - {payment.payment_method || 'Manual'}</span>
                        <span>{prettyDate(payment.paid_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No invoices found for this client.</p>
            <p className="text-sm">Create an invoice to start tracking payments.</p>
          </div>
        )}
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
