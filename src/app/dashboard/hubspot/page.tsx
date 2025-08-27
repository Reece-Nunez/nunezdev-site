'use client';

import { useState } from 'react';
import Link from 'next/link';

interface SyncResult {
  scanned: number;
  upserts: number;
  createdClients?: number;
  dry?: boolean;
}

function SyncButton({ 
  label, 
  endpoint, 
  onComplete 
}: { 
  label: string; 
  endpoint: string; 
  onComplete?: () => void; 
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setBusy(true);
    setResult(null);
    setError(null);
    
    try {
      console.log('Starting sync for:', endpoint);
      const res = await fetch(endpoint);
      const data = await res.json();
      
      console.log('Sync response:', { status: res.status, data });
      
      if (!res.ok) {
        throw new Error(data.error || `${res.status} ${res.statusText}`);
      }
      
      setResult(data);
      onComplete?.();
    } catch (e) {
      console.error('Sync error:', e);
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">{label}</h3>
        <button
          onClick={handleSync}
          disabled={busy}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? 'Syncing...' : 'Sync'}
        </button>
      </div>
      
      {result && (
        <div className="text-sm text-green-700 bg-green-50 p-3 rounded border border-green-200">
          ✓ Scanned: <strong>{result.scanned}</strong>, Upserted: <strong>{result.upserts}</strong>
          {result.createdClients ? `, New clients: ${result.createdClients}` : ''}
        </div>
      )}
      
      {error && (
        <div className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">
          ✗ <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

export default function HubSpotSyncPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<string | null>(null);
  const [syncAllError, setSyncAllError] = useState<string | null>(null);

  const refreshData = () => {
    setRefreshKey(k => k + 1);
  };

  async function syncAll() {
    setSyncAllBusy(true);
    setSyncAllResult(null);
    setSyncAllError(null);

    try {
      const endpoints = [
        { name: 'Contacts', url: '/api/hubspot/backfill/contacts?limit=500&dry=0' },
        { name: 'Quotes', url: '/api/hubspot/backfill/quotes?limit=500&dry=0' },
        { name: 'Deals', url: '/api/hubspot/backfill/deals?limit=500&dry=0' }
      ];
      
      const results = [];
      
      for (const { name, url } of endpoints) {
        console.log(`Syncing ${name}...`);
        const res = await fetch(url);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(`${name} sync failed: ${data.error || res.statusText}`);
        }
        
        results.push(`${name}: ${data.scanned} scanned, ${data.upserts} upserted`);
        if (data.createdClients) results[results.length - 1] += `, ${data.createdClients} new clients`;
      }
      
      setSyncAllResult(results.join(' | '));
      refreshData();
    } catch (e) {
      console.error('Sync All error:', e);
      setSyncAllError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncAllBusy(false);
    }
  }

  return (
    <div className="p-6 my-36 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">HubSpot Sync</h1>
        <button
          onClick={syncAll}
          disabled={syncAllBusy}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncAllBusy ? 'Syncing All...' : 'Sync All'}
        </button>
      </div>

      {syncAllResult && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="text-green-700 text-sm">
            ✓ <strong>Sync All Complete:</strong> {syncAllResult}
          </div>
        </div>
      )}

      {syncAllError && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <div className="text-red-700 text-sm">
            ✗ <strong>Sync All Failed:</strong> {syncAllError}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 cursor-pointer">
        <SyncButton
          label="Sync Contacts → Clients"
          endpoint="/api/hubspot/backfill/contacts?limit=500&dry=0"
          onComplete={refreshData}
        />
        
        <SyncButton
          label="Sync Quotes → Invoices"
          endpoint="/api/hubspot/backfill/quotes?limit=500&dry=0"
          onComplete={refreshData}
        />
        
        <SyncButton
          label="Sync Deals"
          endpoint="/api/hubspot/backfill/deals?limit=500&dry=0"
          onComplete={refreshData}
        />
      </div>

      <div className="rounded-lg border bg-amber-50 p-4">
        <h3 className="font-medium text-amber-800 mb-2">📋 Sync Details</h3>
        <div className="text-sm text-amber-700 space-y-1">
          <p><strong>Contacts:</strong> Creates/updates clients based on HubSpot contacts with email addresses</p>
          <p><strong>Quotes:</strong> Imports HubSpot quotes as invoices, linking to clients by email</p>
          <p><strong>Deals:</strong> Imports HubSpot deals, creating clients if needed and linking by contact email</p>
        </div>
      </div>

      <div className="rounded-lg border bg-blue-50 p-4">
        <h3 className="font-medium text-blue-800 mb-2">🔗 Navigation</h3>
          <Link href="/clients" className="text-blue-600 hover:underline">View Clients</Link>
          <Link href="/clients" className="text-blue-600 hover:underline">View Clients</Link>
          <Link href="/dashboard/invoices" className="text-blue-600 hover:underline">View Invoices</Link>
          <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
        </div>
      </div>
  );
}