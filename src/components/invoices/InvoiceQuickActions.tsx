'use client';

import { useState } from 'react';

interface Invoice {
  id: string;
  status: string;
  amount_cents: number;
  clients?: {
    name: string;
    email: string;
  };
}

interface InvoiceQuickActionsProps {
  selectedInvoices: string[];
  invoices: Invoice[];
  onAction: (action: string, invoiceIds: string[]) => void;
  onClearSelection: () => void;
}

export default function InvoiceQuickActions({
  selectedInvoices,
  invoices,
  onAction,
  onClearSelection,
}: InvoiceQuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (selectedInvoices.length === 0) return null;

  const selectedInvoiceData = invoices.filter(inv => selectedInvoices.includes(inv.id));
  const draftCount = selectedInvoiceData.filter(inv => inv.status === 'draft').length;
  const sentCount = selectedInvoiceData.filter(inv => inv.status === 'sent').length;
  const totalAmount = selectedInvoiceData.reduce((sum, inv) => sum + inv.amount_cents, 0);

  const handleAction = async (action: string) => {
    setLoading(action);
    try {
      await onAction(action, selectedInvoices);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-w-[400px]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">
            {selectedInvoices.length} invoice{selectedInvoices.length > 1 ? 's' : ''} selected
          </div>
          <button
            onClick={onClearSelection}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-600 mb-4">
          <span>Total: <strong>${(totalAmount / 100).toFixed(2)}</strong></span>
          {draftCount > 0 && <span>{draftCount} draft{draftCount > 1 ? 's' : ''}</span>}
          {sentCount > 0 && <span>{sentCount} sent</span>}
        </div>

        <div className="flex gap-2 flex-wrap">
          {draftCount > 0 && (
            <button
              onClick={() => handleAction('send')}
              disabled={loading !== null}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loading === 'send' ? 'Sending...' : `Send ${draftCount} Draft${draftCount > 1 ? 's' : ''}`}
            </button>
          )}

          <button
            onClick={() => handleAction('duplicate')}
            disabled={loading !== null}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            {loading === 'duplicate' ? 'Duplicating...' : 'Duplicate'}
          </button>

          <button
            onClick={() => handleAction('export')}
            disabled={loading !== null}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            {loading === 'export' ? 'Exporting...' : 'Export'}
          </button>

          {selectedInvoices.length === 1 && (
            <button
              onClick={() => handleAction('edit')}
              disabled={loading !== null}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              Edit
            </button>
          )}

          <button
            onClick={() => handleAction('delete')}
            disabled={loading !== null}
            className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm"
          >
            {loading === 'delete' ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}