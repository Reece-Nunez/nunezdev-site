'use client';

import { useState } from 'react';

interface CleanupResult {
  total_active_links: number;
  valid_links: number;
  orphaned_found: number;
  deactivated: string[];
  failed: { id: string; error: string }[];
}

export default function CleanupPaymentLinksPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/cleanup-orphaned-payment-links', {
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

  return (
    <div className="p-8 max-w-2xl mx-auto py-36">
      <h1 className="text-2xl font-bold mb-6">Admin: Cleanup Orphaned Payment Links</h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-yellow-800 mb-2">What this does:</h2>
        <ul className="text-yellow-700 text-sm space-y-1">
          <li>- Scans all active Stripe payment links tied to your invoices</li>
          <li>- Compares them against current payment plan installments in the database</li>
          <li>- Deactivates any payment links that no longer have a matching installment</li>
          <li>- Prevents clients from paying on outdated or deleted payment plans</li>
        </ul>
      </div>

      <button
        onClick={handleCleanup}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium"
      >
        {loading ? 'Scanning Stripe...' : 'Cleanup Orphaned Links'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <strong className="text-red-800">Error:</strong>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="p-4 bg-gray-50 border rounded-lg space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-600">Active Stripe links found:</span>
              <span className="font-medium">{result.total_active_links}</span>

              <span className="text-gray-600">Valid links (in DB):</span>
              <span className="font-medium">{result.valid_links}</span>

              <span className="text-gray-600">Orphaned links found:</span>
              <span className={`font-medium ${result.orphaned_found > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {result.orphaned_found}
              </span>

              <span className="text-gray-600">Successfully deactivated:</span>
              <span className="font-medium text-green-600">{result.deactivated.length}</span>
            </div>
          </div>

          {result.deactivated.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Deactivated Links:</h3>
              <ul className="text-green-700 text-xs space-y-1 font-mono">
                {result.deactivated.map(id => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </div>
          )}

          {result.failed.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Failed to deactivate:</h3>
              <ul className="text-red-700 text-xs space-y-1">
                {result.failed.map(f => (
                  <li key={f.id}><span className="font-mono">{f.id}</span>: {f.error}</li>
                ))}
              </ul>
            </div>
          )}

          {result.orphaned_found === 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">All clear - no orphaned payment links found.</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 text-sm text-gray-600">
        <p><strong>Note:</strong> This only affects payment links created by the payment plan system. Regular Stripe payment links are not touched.</p>
        <p className="mt-1">Run this after editing an invoice&apos;s payment plan to ensure old links are cleaned up.</p>
      </div>
    </div>
  );
}
