'use client';

import { useState } from 'react';

interface AddPaymentProps {
  clientId: string;
  onCreated?: () => void;
}

export default function AddPayment({ clientId, onCreated }: AddPaymentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount_cents: '',
    description: '',
    payment_method: 'cash',
    paid_at: new Date().toISOString().slice(0, 16), // datetime-local format
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount_cents || !formData.description) return;

    setLoading(true);
    try {
      // Convert dollars to cents
      const amountInCents = Math.round(parseFloat(formData.amount_cents) * 100);
      
      const res = await fetch(`/api/clients/${clientId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: amountInCents,
          description: formData.description,
          payment_method: formData.payment_method,
          paid_at: new Date(formData.paid_at).toISOString(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add payment');
      }

      // Reset form
      setFormData({
        amount_cents: '',
        description: '',
        payment_method: 'cash',
        paid_at: new Date().toISOString().slice(0, 16),
      });
      setIsOpen(false);
      onCreated?.();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert(error instanceof Error ? error.message : 'Failed to add payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
      >
        + Add Manual Payment
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Add Manual Payment</h3>
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
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Website updates, maintenance, etc."
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Payment Method
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="paypal">PayPal</option>
                  <option value="venmo">Venmo</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Payment Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.paid_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, paid_at: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.amount_cents || !formData.description}
                  className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}