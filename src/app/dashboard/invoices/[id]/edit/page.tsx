'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import InvoiceBuilder from '@/components/invoices/InvoiceBuilder';
import type { CreateInvoiceData } from '@/types/invoice';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invoice data
  const { data: invoiceData, error: fetchError } = useSWR(`/api/invoices/${id}/details`, fetcher);

  // Fetch clients for the dropdown
  const { data: clientsData } = useSWR('/api/clients', fetcher);
  const clients = clientsData?.clients || [];

  // API returns invoice directly, not wrapped in { invoice: ... }
  const invoice = invoiceData;

  const handleSaveInvoice = async (invoiceData: CreateInvoiceData) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update invoice');
      }

      // Redirect back to the invoice
      router.push(`/dashboard/invoices/${id}`);
    } catch (err) {
      console.error('Error updating invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/dashboard/invoices/${id}`);
  };

  if (fetchError) {
    return (
      <div className="px-3 py-4 sm:p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Failed to load invoice
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="px-3 py-4 sm:p-6 max-w-5xl mx-auto">
        <div className="text-gray-500">Loading invoice...</div>
      </div>
    );
  }

  // Convert invoice data to the format InvoiceBuilder expects
  const initialData: Partial<CreateInvoiceData> = {
    client_id: invoice.client_id,
    title: invoice.title || '',
    description: invoice.description || '',
    notes: invoice.notes || '',
    line_items: invoice.line_items || [],
    payment_terms: invoice.payment_terms || '30',
    require_signature: invoice.require_signature ?? true,
    send_immediately: false,
    brand_logo_url: invoice.brand_logo_url || '/logo.png',
    brand_primary: invoice.brand_primary || '#ffc312',
    project_overview: invoice.project_overview || '',
    project_start_date: invoice.project_start_date || '',
    delivery_date: invoice.delivery_date || '',
    discount_type: invoice.discount_type || 'percentage',
    discount_value: invoice.discount_value || 0,
    technology_stack: invoice.technology_stack || [],
    terms_conditions: invoice.terms_conditions || '',
    // Payment plan fields
    payment_plan_enabled: invoice.payment_plan_enabled || false,
    payment_plan_type: invoice.payment_plan_type || 'full',
    payment_plan_installments: (invoice.invoice_payment_plans || []).map((p: any) => ({
      id: p.id,
      installment_number: p.installment_number,
      installment_label: p.installment_label,
      amount_cents: p.amount_cents,
      due_date: p.due_date,
      grace_period_days: p.grace_period_days ?? 3,
    })),
  };

  return (
    <div className="px-3 py-4 sm:p-6 space-y-4 max-w-5xl mx-auto min-w-0">
      <div className="mb-6">
        <button
          onClick={handleCancel}
          className="text-blue-600 hover:underline text-sm mb-2"
        >
          ← Back to Invoice
        </button>
        <h1 className="text-3xl font-bold">Edit Invoice</h1>
        <p className="text-gray-600 mt-1">
          {invoice.invoice_number} - {invoice.title || 'Untitled'}
        </p>
        {invoice.status && (
          <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
            invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
            invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
            invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <InvoiceBuilder
        clients={clients}
        initialData={initialData}
        onSave={handleSaveInvoice}
        onCancel={handleCancel}
        loading={saving}
      />
    </div>
  );
}
