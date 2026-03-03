'use client';

import { useState, useEffect } from 'react';
import { currency } from '@/lib/ui';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface ChargeCardModalProps {
  clientId: string;
  invoiceId: string;
  amountCents: number;
  installmentId?: string;
  label?: string; // e.g. "50% Deposit" or "Invoice #INV-001"
  onCharged?: () => void;
  onClose: () => void;
}

const brandDisplay: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  discover: 'Discover',
  diners: 'Diners',
  jcb: 'JCB',
  unionpay: 'UnionPay',
};

export default function ChargeCardModal({
  clientId,
  invoiceId,
  amountCents,
  installmentId,
  label,
  onCharged,
  onClose,
}: ChargeCardModalProps) {
  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch(`/api/clients/${clientId}/payment-methods`)
      .then((r) => r.json())
      .then((data) => setCards(data.payment_methods || []))
      .catch(() => setCards([]))
      .finally(() => setLoadingCards(false));
  }, [clientId]);

  const handleCharge = async (pm: PaymentMethod) => {
    setCharging(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/clients/${clientId}/charge-saved-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method_id: pm.id,
          invoice_id: invoiceId,
          amount_cents: amountCents,
          ...(installmentId ? { installment_id: installmentId } : {}),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to charge card');
        return;
      }

      setSuccess(
        `Charged ${currency(amountCents)} to ${brandDisplay[pm.brand] || pm.brand} **** ${pm.last4}`
      );
      onCharged?.();
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to charge card');
    } finally {
      setCharging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="mb-1 text-lg font-semibold">Charge Saved Card</h3>
        <p className="mb-1 text-sm text-gray-500">
          {label || 'Invoice payment'} — {currency(amountCents)}
        </p>

        {success && (
          <div className="my-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {error && (
          <div className="my-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!success && (
          <>
            {loadingCards ? (
              <p className="py-4 text-sm text-gray-400">Loading saved cards...</p>
            ) : cards.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">
                No saved cards on file. Cards are saved automatically when clients pay invoices online.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {cards.map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => handleCharge(pm)}
                    disabled={charging}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {brandDisplay[pm.brand] || pm.brand}
                      </span>
                      <span className="text-sm text-gray-600">**** {pm.last4}</span>
                      <span className="text-xs text-gray-400">
                        {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                      </span>
                    </div>
                    <span className="text-sm text-blue-600 font-medium">
                      {charging ? 'Charging...' : `Charge ${currency(amountCents)}`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={charging}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
