'use client';

import { useState } from 'react';
import Link from 'next/link';
import InvoiceSelector from '@/components/hubspot/InvoiceSelector';

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

export default function HubSpotSyncPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<string | null>(null);
  const [syncAllError, setSyncAllError] = useState<string | null>(null);
  
  // Invoice preview states
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoicePreviewBusy, setInvoicePreviewBusy] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<InvoicePreview[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const refreshData = () => {
    setRefreshKey(k => k + 1);
  };

  const previewInvoices = async () => {
    setInvoicePreviewBusy(true);
    setImportResult(null);
    
    try {
      const response = await fetch('/api/hubspot/backfill/invoices?limit=100&preview=1');
      const data = await response.json();
      
      if (response.ok) {
        setInvoicePreview(data.preview || []);
        setShowInvoicePreview(true);
      } else {
        alert(`Preview failed: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to preview invoices');
    } finally {
      setInvoicePreviewBusy(false);
    }
  };

  const importSelectedInvoices = async (selectedIds: string[]) => {
    setImportBusy(true);
    setImportResult(null);
    
    try {
      const response = await fetch('/api/hubspot/backfill/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_invoices: selectedIds })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setImportResult(`✅ Successfully imported ${data.created} invoices! ${data.skipped} skipped, ${data.errors.length} errors.`);
        // Refresh preview to show updated status
        await previewInvoices();
      } else {
        setImportResult(`❌ Import failed: ${data.error}`);
      }
    } catch (error) {
      setImportResult('❌ Import failed: Network error');
    } finally {
      setImportBusy(false);
    }
  };

  async function syncAll() {
    setSyncAllBusy(true);
    setSyncAllResult(null);
    setSyncAllError(null);

    try {
      const endpoints = [
        { name: 'Contacts', url: '/api/hubspot/backfill/contacts?limit=100&dry=0' },
        { name: 'Quotes', url: '/api/hubspot/backfill/quotes?limit=100&dry=0' },
        { name: 'Invoices', url: '/api/hubspot/backfill/invoices?limit=100&dry=0' }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 cursor-pointer">
        <SyncButton
          label="Sync Contacts → Clients"
          endpoint="/api/hubspot/backfill/contacts?limit=100&dry=0"
          onComplete={refreshData}
        />
        
        <SyncButton
          label="Sync Quotes → Invoices"
          endpoint="/api/hubspot/backfill/quotes?limit=100&dry=0"
          onComplete={refreshData}
        />
        
        <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="text-center">
            <button
              onClick={previewInvoices}
              disabled={invoicePreviewBusy}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed mb-2"
            >
              {invoicePreviewBusy ? 'Loading...' : 'Preview HubSpot Invoices'}
            </button>
            <div className="text-xs text-gray-500">Select which invoices to import</div>
          </div>
        </div>
      </div>

      {/* Invoice Preview Section */}
      {showInvoicePreview && (
        <div className="space-y-4">
          {importResult && (
            <div className={`p-4 rounded-lg ${
              importResult.startsWith('✅') 
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {importResult}
            </div>
          )}
          
          <InvoiceSelector
            invoices={invoicePreview}
            onImport={importSelectedInvoices}
            isImporting={importBusy}
          />
        </div>
      )}

      <div className="rounded-lg border bg-amber-50 p-4">
        <h3 className="font-medium text-amber-800 mb-2">📋 Sync Details</h3>
        <div className="text-sm text-amber-700 space-y-1">
          <p><strong>Contacts:</strong> Creates/updates clients based on HubSpot contacts with email addresses</p>
          <p><strong>Quotes:</strong> Imports HubSpot quotes as invoices, linking to clients by email</p>
          <p><strong>HubSpot Invoices:</strong> Preview and selectively import actual HubSpot invoices with payment status</p>
        </div>
      </div>

      <div className="rounded-lg border bg-blue-50 p-4">
        <h3 className="font-medium text-blue-800 mb-2">Navigation</h3>
          <Link href="/dashboard/clients" className="text-blue-600 hover:underline mx-4">View Clients</Link>
          <Link href="/dashboard/invoices" className="text-blue-600 hover:underline mx-4">View Invoices</Link>
          <Link href="/dashboard" className="text-blue-600 hover:underline mx-4">Dashboard</Link>
        </div>
      </div>
  );
}