'use client';

import { useState } from 'react';

export default function MigrateDealsPage() {
  const [status, setStatus] = useState<string>('Ready to migrate');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function runMigration() {
    setLoading(true);
    setStatus('Running migration...');
    
    try {
      const response = await fetch('/api/run-migration', {
        method: 'POST',
        credentials: 'include' // Include cookies for auth
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatus('Migration completed successfully!');
        setResults(data);
      } else {
        setStatus(`Migration failed: ${data.error}`);
        setResults(data);
      }
    } catch (error) {
      setStatus(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto my-36">
      <h1 className="text-2xl font-semibold mb-6">Deal Stages Migration</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-yellow-800">What this does:</h2>
        <ul className="mt-2 text-yellow-700 space-y-1">
          <li>• Updates deal stages from old HubSpot stages to your new custom stages</li>
          <li>• Maps: New/Discovery/Qualified/Appointment → Contacted</li>
          <li>• Maps: Proposal/Contract → Negotiation</li>
          <li>• Leaves Won/Lost unchanged</li>
        </ul>
      </div>

      <div className="space-y-4">
        <div>
          <strong>Status:</strong> <span className="ml-2">{status}</span>
        </div>
        
        <button
          onClick={runMigration}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Running Migration...' : 'Run Deal Stages Migration'}
        </button>
        
        {results && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Migration Results:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-800 mb-2">Important Note:</h3>
        <p className="text-red-700">
          This migration updates your deal data, but the database constraint still needs to be updated 
          when Supabase dashboard is accessible again. Until then, you might see some validation errors 
          when creating new deals.
        </p>
      </div>
    </div>
  );
}