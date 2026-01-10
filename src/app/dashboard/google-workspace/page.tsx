'use client';

import { useState, useEffect } from 'react';
import { ArrowPathIcon, CloudArrowUpIcon, TableCellsIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface SyncStatus {
  contacts: {
    lastIncrementalSyncAt?: string;
    lastFullSyncAt?: string;
  } | null;
  recentLogs: Array<{
    entityType: string;
    syncDirection: string;
    syncStatus: string;
    syncedAt: string;
  }>;
}

export default function GoogleWorkspacePage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  async function fetchSyncStatus() {
    try {
      const res = await fetch('/api/google/contacts/sync');
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function triggerSync(fullSync: boolean = false) {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/google/contacts/sync${fullSync ? '?full=true' : ''}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Sync complete: ${data.created} created, ${data.updated} updated${data.conflicts > 0 ? `, ${data.conflicts} conflicts` : ''}`,
        });
        fetchSyncStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Sync failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  }

  async function exportToSheets(type: 'clients' | 'invoices') {
    setExporting(type);
    setMessage(null);
    try {
      const res = await fetch(`/api/google/sheets/export/${type}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.spreadsheetUrl) {
        setMessage({
          type: 'success',
          text: `Exported ${data.clientCount || data.invoiceCount || 0} ${type} to Google Sheets`,
        });
        // Open the spreadsheet in a new tab
        window.open(data.spreadsheetUrl, '_blank');
      } else {
        setMessage({ type: 'error', text: data.error || 'Export failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Export failed' });
    } finally {
      setExporting(null);
    }
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Google Workspace</h1>

      {/* Status Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
          ) : (
            <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
          )}
          {message.text}
        </div>
      )}

      {/* Contacts Sync Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Google Contacts</h2>
            <p className="text-sm text-gray-500">
              Bidirectional sync between your clients and Google Contacts
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => triggerSync(false)}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={() => triggerSync(true)}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Full Sync
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Last Incremental Sync:</span>{' '}
              <span className="text-gray-900 font-medium">
                {formatDate(syncStatus?.contacts?.lastIncrementalSyncAt)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Last Full Sync:</span>{' '}
              <span className="text-gray-900 font-medium">
                {formatDate(syncStatus?.contacts?.lastFullSyncAt)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Export to Google Sheets</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => exportToSheets('clients')}
            disabled={exporting !== null}
            className="flex items-center justify-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <TableCellsIcon className="w-6 h-6 text-green-600" />
            <div className="text-left">
              <div className="font-medium text-gray-900">
                {exporting === 'clients' ? 'Exporting...' : 'Export Clients'}
              </div>
              <div className="text-sm text-gray-500">All clients to a new spreadsheet</div>
            </div>
          </button>
          <button
            onClick={() => exportToSheets('invoices')}
            disabled={exporting !== null}
            className="flex items-center justify-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <TableCellsIcon className="w-6 h-6 text-blue-600" />
            <div className="text-left">
              <div className="font-medium text-gray-900">
                {exporting === 'invoices' ? 'Exporting...' : 'Export Invoices'}
              </div>
              <div className="text-sm text-gray-500">All invoices to a new spreadsheet</div>
            </div>
          </button>
        </div>
      </div>

      {/* Google Drive Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Google Drive</h2>
        <p className="text-sm text-gray-500 mb-4">
          Client documents are stored in: <code className="bg-gray-100 px-2 py-1 rounded">/NunezDev/Clients/</code>
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CloudArrowUpIcon className="w-5 h-5" />
          Upload files directly from client pages to automatically organize them in Drive
        </div>
      </div>

      {/* Recent Sync Activity */}
      {syncStatus?.recentLogs && syncStatus.recentLogs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Sync Activity</h2>
          <div className="space-y-2">
            {syncStatus.recentLogs.slice(0, 10).map((log, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      log.syncStatus === 'success'
                        ? 'bg-green-500'
                        : log.syncStatus === 'error'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                    }`}
                  />
                  <span className="text-gray-900 capitalize">{log.entityType}</span>
                  <span className="text-gray-500">
                    {log.syncDirection === 'to_google' ? '→ Google' : '← Google'}
                  </span>
                </div>
                <span className="text-gray-500">{formatDate(log.syncedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
