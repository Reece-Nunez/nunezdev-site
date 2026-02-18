'use client';

import { useState } from 'react';

interface BackfillResult {
  total: number;
  backfilled: number;
  failed: number;
  errors?: { id: string; error: string }[];
  message?: string;
}

export default function BackfillStripeFeesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBackfill = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/backfill-stripe-fees', {
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
      <h1 className="text-2xl font-bold mb-6">Admin: Backfill Stripe Fees</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-blue-800 mb-2">What this does:</h2>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>- Finds all Stripe payments that don&apos;t have fee data recorded</li>
          <li>- Retrieves the actual processing fee from Stripe for each payment</li>
          <li>- Stores the fee amount so it shows in your revenue analytics</li>
          <li>- Safe to run multiple times &mdash; only processes payments missing fee data</li>
        </ul>
      </div>

      <button
        onClick={handleBackfill}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium"
      >
        {loading ? 'Fetching fees from Stripe...' : 'Backfill Stripe Fees'}
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
              <span className="text-gray-600">Payments needing backfill:</span>
              <span className="font-medium">{result.total}</span>

              <span className="text-gray-600">Successfully backfilled:</span>
              <span className="font-medium text-green-600">{result.backfilled}</span>

              <span className="text-gray-600">Failed:</span>
              <span className={`font-medium ${result.failed > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {result.failed}
              </span>
            </div>
          </div>

          {result.backfilled > 0 && result.failed === 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">All fees backfilled successfully.</p>
            </div>
          )}

          {result.total === 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">All payments already have fee data &mdash; nothing to backfill.</p>
            </div>
          )}

          {result.errors && result.errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Errors:</h3>
              <ul className="text-red-700 text-xs space-y-1">
                {result.errors.map(e => (
                  <li key={e.id}><span className="font-mono">{e.id}</span>: {e.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
