'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DocumentArrowDownIcon, PaperAirplaneIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useConfirm } from '@/components/ui/Toast';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ReportRecord {
  id: string;
  client_id: string;
  report_month: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  clients: {
    name: string;
    email: string | null;
    company: string | null;
  };
}

export default function ReportHistory() {
  const { data, isLoading, mutate } = useSWR<ReportRecord[]>('/api/client-reports', fetcher);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { confirm, ConfirmContainer } = useConfirm();

  const reports = data || [];

  const handleDownload = async (report: ReportRecord) => {
    setDownloadingId(report.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/client-reports/${report.id}/pdf`);
      if (!res.ok) throw new Error('Failed to generate PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const monthLabel = new Date(report.report_month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      a.download = `${report.clients.name.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${monthLabel.replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Download failed' });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleResend = async (report: ReportRecord) => {
    if (!report.clients.email) {
      setMessage({ type: 'error', text: 'Client has no email address' });
      return;
    }

    const confirmed = await confirm({ title: 'Resend Report', message: `Resend report to ${report.clients.email}?`, confirmLabel: 'Resend', variant: 'info' });
    if (!confirmed) return;

    setSendingId(report.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/client-reports/${report.id}/send`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to send');

      setMessage({ type: 'success', text: `Report sent to ${report.clients.email}!` });
      mutate();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Send failed' });
    } finally {
      setSendingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConfirmContainer />
      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">
          No reports yet. Create your first report above!
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Month</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden sm:table-cell">Created</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.map(report => {
                const monthLabel = new Date(report.report_month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                const isDownloading = downloadingId === report.id;
                const isSending = sendingId === report.id;

                return (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{report.clients.name}</div>
                      {report.clients.company && (
                        <div className="text-xs text-gray-500">{report.clients.company}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{monthLabel}</td>
                    <td className="px-4 py-3 text-center">
                      {report.sent_at ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircleIcon className="w-3 h-3" />
                          Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">
                      {new Date(report.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDownload(report)}
                          disabled={isDownloading}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                          title="Download PDF"
                        >
                          <DocumentArrowDownIcon className="w-4 h-4" />
                          {isDownloading ? '...' : 'PDF'}
                        </button>
                        <button
                          onClick={() => handleResend(report)}
                          disabled={isSending || !report.clients.email}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-300 text-blue-700 px-3 py-1.5 text-xs font-medium hover:bg-blue-50 disabled:opacity-50"
                          title={report.clients.email ? `Send to ${report.clients.email}` : 'No email'}
                        >
                          <PaperAirplaneIcon className="w-4 h-4" />
                          {isSending ? '...' : 'Send'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
