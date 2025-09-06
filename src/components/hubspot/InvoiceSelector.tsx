'use client';

import { useState } from 'react';

interface InvoicePreview {
  hubspot_id: string;
  invoice_number: string;
  amount_cents: number;
  amount_display: string;
  status: string;
  hubspot_status: string;
  client_name: string;
  client_email: string;
  date: string;
  exists_in_db: boolean;
  existing_id?: string;
  can_import: boolean;
  skip_reason?: string;
}

interface InvoiceSelectorProps {
  invoices: InvoicePreview[];
  onImport: (selectedIds: string[]) => void;
  isImporting: boolean;
}

export default function InvoiceSelector({ invoices, onImport, isImporting }: InvoiceSelectorProps) {
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  const toggleSelection = (hubspotId: string) => {
    const newSelection = new Set(selectedInvoices);
    if (newSelection.has(hubspotId)) {
      newSelection.delete(hubspotId);
    } else {
      newSelection.add(hubspotId);
    }
    setSelectedInvoices(newSelection);
  };

  const toggleAll = () => {
    const importableInvoices = invoices.filter(inv => inv.can_import);
    if (selectedInvoices.size === importableInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(importableInvoices.map(inv => inv.hubspot_id)));
    }
  };

  const handleImport = () => {
    if (selectedInvoices.size > 0) {
      onImport(Array.from(selectedInvoices));
    }
  };

  const importableCount = invoices.filter(inv => inv.can_import).length;
  const selectedCount = selectedInvoices.size;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">HubSpot Invoices Preview</h2>
          <p className="text-sm text-gray-600">
            Found {invoices.length} invoices • {importableCount} can be imported
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedCount > 0 && selectedCount === importableCount}
              onChange={toggleAll}
              disabled={importableCount === 0}
              className="rounded border-gray-300"
            />
            Select All Importable
          </label>
          <button
            onClick={handleImport}
            disabled={selectedCount === 0 || isImporting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? `Importing ${selectedCount}...` : `Import Selected (${selectedCount})`}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-3 py-2"></th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Invoice #
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Client
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Import Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.map((invoice) => (
              <tr 
                key={invoice.hubspot_id}
                className={`${invoice.can_import ? 'hover:bg-gray-50' : 'bg-gray-25'}`}
              >
                <td className="px-3 py-2">
                  {invoice.can_import && (
                    <input
                      type="checkbox"
                      checked={selectedInvoices.has(invoice.hubspot_id)}
                      onChange={() => toggleSelection(invoice.hubspot_id)}
                      className="rounded border-gray-300"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-sm">{invoice.invoice_number}</div>
                  <div className="text-xs text-gray-500 font-mono">
                    {invoice.hubspot_id.substring(0, 8)}...
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-sm">{invoice.client_name}</div>
                  <div className="text-xs text-gray-500">{invoice.client_email}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{invoice.amount_display}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      invoice.status === 'paid' 
                        ? 'bg-green-100 text-green-800'
                        : invoice.status === 'sent'
                        ? 'bg-blue-100 text-blue-800'
                        : invoice.status === 'draft'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {invoice.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      HS: {invoice.hubspot_status}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-sm">
                  {new Date(invoice.date).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  {invoice.exists_in_db ? (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Already Exists
                    </span>
                  ) : invoice.can_import ? (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Can Import
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      {invoice.skip_reason}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoices.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No invoices found in HubSpot</p>
        </div>
      )}
    </div>
  );
}