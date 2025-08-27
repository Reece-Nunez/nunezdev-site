'use client';

import { useState } from 'react';
import type { InvoiceLite } from '@/types/client_detail';

interface EditInvoiceProps {
  invoice: InvoiceLite;
  onUpdated?: () => void;
  onCancel?: () => void;
}

export default function EditInvoice({ invoice, onUpdated, onCancel }: EditInvoiceProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount_cents: (invoice.amount_cents / 100).toString(), // Convert to dollars
    description: invoice.description || '',
    status: invoice.status || 'draft',
    issued_at: invoice.issued_at ? new Date(invoice.issued_at).toISOString().slice(0, 16) : '', // datetime-local format
    due_at: invoice.due_at ? new Date(invoice.due_at).toISOString().slice(0, 16) : '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount_cents) return;

    setLoading(true);
    try {
      // Convert dollars to cents
      const amountInCents = Math.round(parseFloat(formData.amount_cents) * 100);
      
      const payload = {
        amount_cents: amountInCents,
        description: formData.description,
        status: formData.status,
        issued_at: formData.issued_at ? new Date(formData.issued_at).toISOString() : null,
        due_at: formData.due_at ? new Date(formData.due_at).toISOString() : null,
      };

      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update invoice');
      }

      onUpdated?.();
    } catch (error) {
      console.error('Error updating invoice:', error);
      alert(error instanceof Error ? error.message : 'Failed to update invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Edit Invoice</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount_cents}
              onChange={(e) => setFormData(prev => ({ ...prev, amount_cents: e.target.value }))}
              className="w-full rounded border px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Invoice description or notes"
              className="w-full rounded border px-3 py-2 h-20"
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full rounded border px-3 py-2"
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="void">Void</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Issued Date
            </label>
            <input
              type="datetime-local"
              value={formData.issued_at}
              onChange={(e) => setFormData(prev => ({ ...prev, issued_at: e.target.value }))}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Due Date
            </label>
            <input
              type="datetime-local"
              value={formData.due_at}
              onChange={(e) => setFormData(prev => ({ ...prev, due_at: e.target.value }))}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.amount_cents}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}