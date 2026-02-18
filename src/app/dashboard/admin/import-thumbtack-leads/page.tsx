'use client';

import { useState } from 'react';

interface LeadResult {
  name: string;
  amount: string;
  client_matched: boolean;
  note?: string;
}

interface ImportResult {
  total_leads: number;
  imported: number;
  clients_matched: number;
  leads_not_converted: number;
  total_spent: string;
  results: LeadResult[];
  message?: string;
  existing_count?: number;
}

export default function ImportThumbTackLeadsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ message: string; deleted: number; entries?: { description: string; amount: string; date: string }[] } | null>(null);

  const handleImport = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/import-thumbtack-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    setCleanupLoading(true);
    setCleanupResult(null);

    try {
      const response = await fetch('/api/admin/cleanup-duplicate-thumbtack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok) {
        setCleanupResult(data);
      } else {
        setError(data.error || 'Cleanup failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto py-36">
      <h1 className="text-2xl font-bold mb-6">Admin: Import Thumbtack Lead Fees</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-blue-800 mb-2">What this does:</h2>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>- Imports 34 Thumbtack lead fees as expenses (Jul 2025 &ndash; Feb 2026)</li>
          <li>- Matches lead names to existing clients in your database</li>
          <li>- Unmatched leads are marked as &quot;Lead not converted&quot;</li>
          <li>- All entries categorized as &quot;Lead Fees&quot; with vendor &quot;Thumbtack&quot;</li>
          <li>- Safe to run &mdash; checks if already imported before adding duplicates</li>
        </ul>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleImport}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-6 py-2 rounded-lg font-medium"
        >
          {loading ? 'Importing...' : 'Import Thumbtack Lead Fees'}
        </button>

        <button
          onClick={handleCleanup}
          disabled={cleanupLoading}
          className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white px-6 py-2 rounded-lg font-medium"
        >
          {cleanupLoading ? 'Cleaning up...' : 'Remove Old Bulk Thumbtack Entries'}
        </button>
      </div>

      {cleanupResult && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">{cleanupResult.message}</p>
          {cleanupResult.entries && cleanupResult.entries.length > 0 && (
            <ul className="mt-2 text-sm text-green-700 space-y-1">
              {cleanupResult.entries.map((e, i) => (
                <li key={i}>{e.description} &mdash; {e.amount} on {e.date}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <strong className="text-red-800">Error:</strong>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          {result.message && !result.results && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700 font-medium">{result.message}</p>
            </div>
          )}

          {result.results && (
            <>
              <div className="p-4 bg-gray-50 border rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-600">Total leads:</span>
                  <span className="font-medium">{result.total_leads}</span>
                  <span className="text-gray-600">Imported:</span>
                  <span className="font-medium text-green-600">{result.imported}</span>
                  <span className="text-gray-600">Matched to clients:</span>
                  <span className="font-medium text-emerald-600">{result.clients_matched}</span>
                  <span className="text-gray-600">Leads not converted:</span>
                  <span className="font-medium text-gray-500">{result.leads_not_converted}</span>
                  <span className="text-gray-600">Total spent:</span>
                  <span className="font-bold">{result.total_spent}</span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="px-4 py-2">Lead Name</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.results.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-2 font-medium">{r.name}</td>
                        <td className="px-4 py-2 text-right">{r.amount}</td>
                        <td className="px-4 py-2">
                          {r.client_matched ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Client matched</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Not converted</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">{r.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
