'use client';

import Link from 'next/link';
import { useState } from 'react';
import ClientForm from '@/components/client-detail/ClientForm';
import ClientNotes from '@/components/client-detail/ClientNotes';
import ClientTasks from '@/components/client-detail/ClientTasks';
import { ClientInvoices } from '@/components/client-detail/Related';
import AddPayment from '@/components/client-detail/AddPayment';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';

export default function ClientDetailContent({ clientId }: { clientId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isExporting, setIsExporting] = useState(false);
  const bump = () => setRefreshKey((k) => k + 1);

  const handleExportTaxPDF = async () => {
    setIsExporting(true);
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
      a.download = `tax_summary_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      alert(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Generate year options (current year and previous 4 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/clients" className="text-sm text-blue-600 hover:underline">
          ← Back to clients
        </Link>
      </div>

      <ClientForm clientId={clientId} />

      {/* Invoices & Payments */}
      <section className="rounded-lg border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="font-semibold">Invoices & Payments</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Tax Export Controls */}
            <div className="flex items-center gap-2 pr-2 border-r border-gray-200">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                onClick={handleExportTaxPDF}
                disabled={isExporting}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export tax summary PDF for selected year"
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                {isExporting ? 'Generating...' : 'Tax PDF'}
              </button>
            </div>

            <Link
              href={`/dashboard/invoices/new?clientId=${clientId}`}
              className="rounded-lg px-4 py-2 text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: '#ffc312' }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#e6ad0f'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#ffc312'}
            >
              + New Invoice
            </Link>
            <AddPayment clientId={clientId} onCreated={bump} />
          </div>
        </div>
        <div>
          <ClientInvoices key={`invoices-${refreshKey}`} clientId={clientId} />
        </div>
      </section>

      {/* Notes */}
      <ClientNotes clientId={clientId} />

      {/* Tasks */}
      <ClientTasks clientId={clientId} />
    </div>
  );
}