'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface LineItem {
  description: string;
  quantity: number;
  rate_cents: number;
  amount_cents: number;
}

interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
}

const PAYMENT_TERMS_OPTIONS = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: '7', label: 'Net 7 days' },
  { value: '14', label: 'Net 14 days' },
  { value: '30', label: 'Net 30 days' },
  { value: '45', label: 'Net 45 days' },
  { value: '60', label: 'Net 60 days' },
];

export default function NewProposalPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: clientsData } = useSWR('/api/clients', fetcher);
  const clients: Client[] = clientsData?.clients || [];

  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    description: '',
    line_items: [{ description: '', quantity: 1, rate_cents: 0, amount_cents: 0 }] as LineItem[],
    valid_until: '',
    project_overview: '',
    project_start_date: '',
    estimated_delivery_date: '',
    technology_stack: '',
    terms_conditions: '',
    payment_terms: '30',
    require_signature: true,
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
  });

  const [rateInputs, setRateInputs] = useState<Record<number, string>>({ 0: '' });

  // Calculate totals
  const { subtotal, discount, total } = useMemo(() => {
    const subtotal = formData.line_items.reduce((sum, item) => sum + item.amount_cents, 0);
    let discount = 0;
    if (formData.discount_value > 0) {
      if (formData.discount_type === 'percentage') {
        discount = Math.round(subtotal * (formData.discount_value / 100));
      } else {
        discount = Math.round(formData.discount_value * 100);
      }
    }
    return { subtotal, discount, total: subtotal - discount };
  }, [formData.line_items, formData.discount_type, formData.discount_value]);

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...formData.line_items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'rate_cents') {
      newItems[index].amount_cents = Math.round(newItems[index].quantity * newItems[index].rate_cents);
    }
    setFormData(prev => ({ ...prev, line_items: newItems }));
  };

  const updateRate = (index: number, dollarValue: string) => {
    setRateInputs(prev => ({ ...prev, [index]: dollarValue }));
    const cents = Math.round((parseFloat(dollarValue) || 0) * 100);
    updateLineItem(index, 'rate_cents', cents);
  };

  const addLineItem = () => {
    const newIndex = formData.line_items.length;
    setFormData(prev => ({
      ...prev,
      line_items: [...prev.line_items, { description: '', quantity: 1, rate_cents: 0, amount_cents: 0 }]
    }));
    setRateInputs(prev => ({ ...prev, [newIndex]: '' }));
  };

  const removeLineItem = (index: number) => {
    if (formData.line_items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.client_id) {
      setError('Please select a client');
      return;
    }
    if (!formData.title) {
      setError('Please enter a title');
      return;
    }
    if (formData.line_items.every(item => !item.description || item.amount_cents === 0)) {
      setError('Please add at least one line item with a description and amount');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create proposal');
      }

      router.push('/dashboard/proposals');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="px-3 py-4 sm:p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/proposals" className="text-emerald-600 hover:underline text-sm mb-4 inline-block">
        ← Back to Proposals
      </Link>
      <h1 className="text-2xl font-bold mb-6">Create New Proposal</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Selection */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold mb-3">Client</h2>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={formData.client_id}
            onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
            required
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company ? `(${c.company})` : ''} - {c.email}
              </option>
            ))}
          </select>
        </div>

        {/* Proposal Details */}
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <h2 className="font-semibold">Proposal Details</h2>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Title *</label>
            <input
              type="text"
              className="w-full rounded-lg border px-3 py-2"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Website Redesign Proposal"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Description</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief summary of what this proposal covers..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Valid Until</label>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2"
                value={formData.valid_until}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Payment Terms</label>
              <select
                className="w-full rounded-lg border px-3 py-2"
                value={formData.payment_terms}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
              >
                {PAYMENT_TERMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold mb-3">Line Items</h2>

          <div className="space-y-3">
            {formData.line_items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-12 sm:col-span-5">
                  <input
                    type="text"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Qty"
                    min="0"
                    step="0.5"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm"
                      placeholder="Rate"
                      min="0"
                      step="0.01"
                      value={rateInputs[index] || ''}
                      onChange={(e) => updateRate(index, e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-span-3 sm:col-span-2 text-right">
                  <div className="py-2 text-sm font-medium">{formatCurrency(item.amount_cents)}</div>
                </div>
                <div className="col-span-1">
                  {formData.line_items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLineItem}
            className="mt-3 text-sm text-emerald-600 hover:text-emerald-800"
          >
            + Add Line Item
          </button>

          {/* Discount */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-600">Discount:</label>
              <input
                type="number"
                className="w-20 rounded-lg border px-3 py-1 text-sm"
                min="0"
                value={formData.discount_value || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
              />
              <select
                className="rounded-lg border px-2 py-1 text-sm"
                value={formData.discount_type}
                onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value as 'percentage' | 'fixed' }))}
              >
                <option value="percentage">%</option>
                <option value="fixed">$ (fixed)</option>
              </select>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t space-y-2 text-right">
            <div className="flex justify-end gap-4">
              <span className="text-gray-600">Subtotal:</span>
              <span className="w-28">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-end gap-4 text-red-600">
                <span>Discount:</span>
                <span className="w-28">-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-end gap-4 font-bold text-lg">
              <span>Total:</span>
              <span className="w-28">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Project Details (optional) */}
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <h2 className="font-semibold">Project Details (Optional)</h2>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Project Overview</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2"
              rows={4}
              value={formData.project_overview}
              onChange={(e) => setFormData(prev => ({ ...prev, project_overview: e.target.value }))}
              placeholder="Detailed scope of work, deliverables, milestones..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Project Start Date</label>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2"
                value={formData.project_start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, project_start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Estimated Delivery Date</label>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2"
                value={formData.estimated_delivery_date}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_delivery_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Technology Stack</label>
            <input
              type="text"
              className="w-full rounded-lg border px-3 py-2"
              value={formData.technology_stack}
              onChange={(e) => setFormData(prev => ({ ...prev, technology_stack: e.target.value }))}
              placeholder="e.g., Next.js, TypeScript, Supabase, Tailwind CSS"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Terms & Conditions</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2"
              rows={4}
              value={formData.terms_conditions}
              onChange={(e) => setFormData(prev => ({ ...prev, terms_conditions: e.target.value }))}
              placeholder="Payment terms, revision policy, ownership transfer, etc."
            />
          </div>
        </div>

        {/* Options */}
        <div className="bg-white rounded-xl border p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.require_signature}
              onChange={(e) => setFormData(prev => ({ ...prev, require_signature: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Require client signature to accept</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/proposals"
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Proposal'}
          </button>
        </div>
      </form>
    </div>
  );
}
