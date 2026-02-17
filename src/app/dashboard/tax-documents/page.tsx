'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { currency } from '@/lib/ui';
import { DocumentArrowDownIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
}

interface InvoiceSummary {
  client_id: string;
  invoice_count: number;
  total_invoiced: number;
  total_paid: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TaxDocumentsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [exportingClients, setExportingClients] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all clients
  const { data: clientsData, isLoading: clientsLoading } = useSWR<{ clients: Client[] }>('/api/clients', fetcher);

  // Fetch invoice summaries for the selected year
  const { data: summaryData, isLoading: summaryLoading } = useSWR<{ summaries: InvoiceSummary[] }>(
    `/api/tax-documents/summary?year=${selectedYear}`,
    fetcher
  );

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Create a map of client summaries
  const summaryMap = useMemo(() => {
    const map = new Map<string, InvoiceSummary>();
    summaryData?.summaries?.forEach(s => map.set(s.client_id, s));
    return map;
  }, [summaryData]);

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    if (!clientsData?.clients) return [];
    const query = searchQuery.toLowerCase();
    return clientsData.clients.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.company?.toLowerCase().includes(query)
    );
  }, [clientsData, searchQuery]);

  // Get clients that have invoices for the selected year
  const clientsWithInvoices = useMemo(() => {
    return filteredClients.filter(c => {
      const summary = summaryMap.get(c.id);
      return summary && summary.invoice_count > 0;
    });
  }, [filteredClients, summaryMap]);

  const handleExportPDF = async (clientId: string, clientName: string) => {
    setExportingClients(prev => new Set(prev).add(clientId));
    try {
      const response = await fetch(`/api/tax-documents/${clientId}?year=${selectedYear}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clientName.replace(/[^a-zA-Z0-9]/g, '_')}_tax_summary_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      alert(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExportingClients(prev => {
        const next = new Set(prev);
        next.delete(clientId);
        return next;
      });
    }
  };

  const handleExportSelected = async () => {
    const clientsToExport = clientsWithInvoices.filter(c => selectedClients.has(c.id));
    for (const client of clientsToExport) {
      await handleExportPDF(client.id, client.name);
    }
    setSelectedClients(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedClients.size === clientsWithInvoices.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clientsWithInvoices.map(c => c.id)));
    }
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const isLoading = clientsLoading || summaryLoading;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Documents</h1>
          <p className="text-sm text-gray-600 mt-1">
            Generate annual invoice summaries for your clients
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border bg-white p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Year Selector */}
          <label className="text-sm">
            <div className="text-gray-600 mb-1">Year</div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          {/* Search */}
          <label className="text-sm sm:col-span-2 lg:col-span-3">
            <div className="text-gray-600 mb-1">Search Clients</div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or company..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>

        {/* Bulk Actions */}
        {selectedClients.size > 0 && (
          <div className="flex items-center gap-3 pt-3 border-t">
            <span className="text-sm text-gray-600">
              {selectedClients.size} client{selectedClients.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleExportSelected}
              disabled={exportingClients.size > 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              {exportingClients.size > 0 ? 'Exporting...' : 'Export Selected'}
            </button>
            <button
              onClick={() => setSelectedClients(new Set())}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-600">Clients with Invoices</div>
          <div className="text-2xl font-bold text-blue-600">
            {isLoading ? '...' : clientsWithInvoices.length}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-600">Total Invoiced ({selectedYear})</div>
          <div className="text-2xl font-bold text-emerald-600">
            {isLoading ? '...' : currency(
              Array.from(summaryMap.values()).reduce((sum, s) => sum + s.total_invoiced, 0)
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-600">Total Collected ({selectedYear})</div>
          <div className="text-2xl font-bold text-purple-600">
            {isLoading ? '...' : currency(
              Array.from(summaryMap.values()).reduce((sum, s) => sum + s.total_paid, 0)
            )}
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedClients.size === clientsWithInvoices.length && clientsWithInvoices.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                    disabled={clientsWithInvoices.length === 0}
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden sm:table-cell">Company</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Invoices</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 hidden md:table-cell">Total Invoiced</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 hidden lg:table-cell">Total Paid</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading clients...
                  </td>
                </tr>
              ) : clientsWithInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {searchQuery ? 'No clients match your search' : `No clients with invoices in ${selectedYear}`}
                  </td>
                </tr>
              ) : (
                clientsWithInvoices.map(client => {
                  const summary = summaryMap.get(client.id);
                  const isExporting = exportingClients.has(client.id);
                  const isSelected = selectedClients.has(client.id);

                  return (
                    <tr key={client.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleClientSelection(client.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/clients/${client.id}`} className="font-medium text-blue-600 hover:underline">
                          {client.name}
                        </Link>
                        {client.email && (
                          <div className="text-xs text-gray-500">{client.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {client.company || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {summary?.invoice_count || 0}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {currency(summary?.total_invoiced || 0)}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        {currency(summary?.total_paid || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleExportPDF(client.id, client.name)}
                          disabled={isExporting}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isExporting ? (
                            <>
                              <span className="animate-spin">
                                <svg className="w-3 h-3" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              </span>
                              Generating...
                            </>
                          ) : (
                            <>
                              <DocumentArrowDownIcon className="w-4 h-4" />
                              Export PDF
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
