'use client';

import { useState } from 'react';

export default function SyncPaymentsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/admin/sync-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResult('✅ ' + data.message);
      } else {
        setResult('❌ Error: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      setResult('❌ Error: ' + (error instanceof Error ? error.message : 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin: Sync Payment Totals</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-yellow-800 mb-2">What this does:</h2>
        <ul className="text-yellow-700 text-sm space-y-1">
          <li>• Recalculates total_paid_cents for all invoices based on actual payments</li>
          <li>• Updates invoice statuses (paid/partially_paid/sent)</li>
          <li>• Fixes client detail pages showing incorrect paid amounts</li>
          <li>• Syncs dashboard totals with actual payment data</li>
        </ul>
      </div>
      
      <button
        onClick={handleSync}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium"
      >
        {loading ? 'Syncing...' : 'Sync Payment Totals'}
      </button>
      
      {result && (
        <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
          <strong>Result:</strong><br />
          {result}
        </div>
      )}
      
      <div className="mt-8 text-sm text-gray-600">
        <p><strong>Note:</strong> You must be logged in as an admin to run this sync operation.</p>
        <p>After running, refresh your client detail pages to see the updated paid amounts.</p>
      </div>
    </div>
  );
}