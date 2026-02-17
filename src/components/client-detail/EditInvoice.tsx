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
    project_overview: (invoice as any).project_overview || '',
    project_start_date: (invoice as any).project_start_date || '',
    delivery_date: (invoice as any).delivery_date || '',
    discount_type: (invoice as any).discount_type || 'percentage',
    discount_value: ((invoice as any).discount_value || 0).toString(),
    technology_stack: (invoice as any).technology_stack || [],
    terms_conditions: (invoice as any).terms_conditions || '',
    require_signature: (invoice as any).require_signature || false,
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
        project_overview: formData.project_overview,
        project_start_date: formData.project_start_date || null,
        delivery_date: formData.delivery_date || null,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value) || 0,
        technology_stack: formData.technology_stack,
        terms_conditions: formData.terms_conditions,
        require_signature: formData.require_signature,
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
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Edit Invoice</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>

          {/* Enhanced Invoice Fields */}
          <div className="space-y-6">
            <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Project Details</h4>
            
            <div>
              <label className="mb-1 block text-sm font-medium">
                Project Overview
              </label>
              <textarea
                value={formData.project_overview}
                onChange={(e) => setFormData(prev => ({ ...prev, project_overview: e.target.value }))}
                placeholder="Brief description of the project scope and objectives..."
                className="w-full rounded border px-3 py-2 h-24"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Project Start Date
                </label>
                <input
                  type="date"
                  value={formData.project_start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, project_start_date: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Discount Configuration */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Discount</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Discount Type
                </label>
                <select
                  value={formData.discount_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount ($)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Discount Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder={formData.discount_type === 'percentage' ? '10' : '100.00'}
                />
              </div>
            </div>
          </div>

          {/* Technology Stack */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Technology Stack</h4>
            
            <div>
              <label className="mb-1 block text-sm font-medium">
                Technologies Used (comma-separated)
              </label>
              <input
                type="text"
                value={Array.isArray(formData.technology_stack) ? formData.technology_stack.join(', ') : ''}
                onChange={(e) => {
                  const techs = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  setFormData(prev => ({ ...prev, technology_stack: techs }));
                }}
                placeholder="React, Node.js, PostgreSQL, TypeScript..."
                className="w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Terms & Conditions</h4>
            
            <div>
              <label className="mb-1 block text-sm font-medium">
                Custom Terms & Conditions
              </label>
              <textarea
                value={formData.terms_conditions}
                onChange={(e) => setFormData(prev => ({ ...prev, terms_conditions: e.target.value }))}
                placeholder="Payment terms, project conditions, or leave blank for default terms..."
                className="w-full rounded border px-3 py-2 h-32"
                rows={6}
              />
            </div>
          </div>

          {/* Signature Requirement */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Signature</h4>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="require_signature"
                checked={formData.require_signature}
                onChange={(e) => setFormData(prev => ({ ...prev, require_signature: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="require_signature" className="text-sm">
                Require client signature before payment
              </label>
            </div>
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