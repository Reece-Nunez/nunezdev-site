'use client';

import { useState } from 'react';

interface Invoice {
  id: string;
  invoice_number?: string;
  title?: string;
  amount_cents: number;
  status: string;
  issued_at?: string;
  clients?: {
    id: string;
    name: string;
    email: string;
  };
}

interface CombineInvoicesModalProps {
  invoices: Invoice[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function CombineInvoicesModal({
  invoices,
  onConfirm,
  onCancel,
  loading = false,
}: CombineInvoicesModalProps) {
  const [error, setError] = useState<string | null>(null);

  const combinedTotal = invoices.reduce((sum, inv) => sum + inv.amount_cents, 0);
  const client = invoices[0]?.clients;

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to combine invoices');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Combine Invoices</h2>
              <p className="text-sm text-gray-500">Create a single invoice from multiple</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
          {/* Client Info */}
          {client && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Client</p>
              <p className="text-gray-900">{client.name}</p>
              <p className="text-sm text-gray-500">{client.email}</p>
            </div>
          )}

          {/* Invoice List */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Invoices to combine ({invoices.length})
            </p>
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-white"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {invoice.invoice_number || `INV-${invoice.id.split('-')[0]}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {invoice.title || 'Invoice'}
                      {invoice.issued_at && (
                        <span className="ml-2">
                          • {new Date(invoice.issued_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      ${(invoice.amount_cents / 100).toFixed(2)}
                    </p>
                    <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                      invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {invoice.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Combined Total */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-blue-900">Combined Total</span>
              <span className="text-2xl font-bold text-blue-600">
                ${(combinedTotal / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Warning */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-medium">Original invoices will be voided</p>
                <p className="mt-1 text-amber-700">
                  The {invoices.length} selected invoices will be marked as void and a new combined invoice will be created and sent to the client.
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Combining...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Combine & Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
