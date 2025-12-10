'use client';

import useSWR from 'swr';
import { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';

const fetcher = (u: string) => fetch(u).then(r => r.json());
const currency = (cents?: number | null) =>
  ((cents ?? 0) / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

interface Proposal {
  id: string;
  proposal_number: string;
  title: string;
  amount_cents: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  sent_at?: string;
  valid_until?: string;
  accepted_at?: string;
  rejected_at?: string;
  converted_to_invoice_id?: string;
  clients?: { id: string; name?: string; email?: string; company?: string } | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700'
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired'
};

export default function ProposalsPage() {
  const { data, error, mutate } = useSWR<{ proposals: Proposal[] }>('/api/proposals', fetcher);
  const { showToast, ToastContainer } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sending, setSending] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  const proposals = data?.proposals ?? [];

  const filteredProposals = statusFilter === 'all'
    ? proposals
    : proposals.filter(p => p.status === statusFilter);

  const handleSend = async (id: string) => {
    setSending(id);
    try {
      const res = await fetch(`/api/proposals/${id}/send`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      showToast('Proposal sent successfully', 'success');
      mutate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send proposal', 'error');
    } finally {
      setSending(null);
    }
  };

  const handleConvert = async (id: string) => {
    setConverting(id);
    try {
      const res = await fetch(`/api/proposals/${id}/convert`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to convert');
      showToast(`Converted to invoice ${json.invoice_number}`, 'success');
      mutate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to convert', 'error');
    } finally {
      setConverting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this proposal?')) return;
    try {
      const res = await fetch(`/api/proposals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Proposal deleted', 'success');
      mutate();
    } catch (err) {
      showToast('Failed to delete proposal', 'error');
    }
  };

  // Stats
  const stats = {
    draft: proposals.filter(p => p.status === 'draft').length,
    sent: proposals.filter(p => p.status === 'sent').length,
    viewed: proposals.filter(p => p.status === 'viewed').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    rejected: proposals.filter(p => p.status === 'rejected').length,
    pendingValue: proposals.filter(p => ['sent', 'viewed'].includes(p.status)).reduce((sum, p) => sum + p.amount_cents, 0),
    acceptedValue: proposals.filter(p => p.status === 'accepted').reduce((sum, p) => sum + p.amount_cents, 0)
  };

  return (
    <>
      <ToastContainer />
      <div className="px-3 py-4 sm:p-6 space-y-4 max-w-full min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Proposals</h1>
          <Link
            href="/dashboard/proposals/new"
            className="rounded-lg px-4 py-2 text-white text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-700"
          >
            + New Proposal
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Draft</div>
            <div className="text-lg font-semibold">{stats.draft}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Sent</div>
            <div className="text-lg font-semibold">{stats.sent}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Viewed</div>
            <div className="text-lg font-semibold">{stats.viewed}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Accepted</div>
            <div className="text-lg font-semibold text-emerald-600">{stats.accepted}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Pending Value</div>
            <div className="text-lg font-semibold text-blue-600">{currency(stats.pendingValue)}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Accepted Value</div>
            <div className="text-lg font-semibold text-emerald-600">{currency(stats.acceptedValue)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border p-3">
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {error ? (
            <div className="p-4 text-red-600">Failed to load proposals</div>
          ) : !data ? (
            <div className="p-4 text-gray-500">Loading...</div>
          ) : filteredProposals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No proposals found</p>
              <Link href="/dashboard/proposals/new" className="text-emerald-600 hover:underline mt-2 inline-block">
                Create your first proposal
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Proposal</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Valid Until</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProposals.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{p.proposal_number}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{p.title}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{p.clients?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{p.clients?.company}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-sm">{currency(p.amount_cents)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[p.status]}`}>
                            {statusLabels[p.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {p.status === 'draft' && (
                              <>
                                <Link href={`/dashboard/proposals/${p.id}/edit`} className="text-xs text-gray-600 hover:text-gray-900">
                                  Edit
                                </Link>
                                <button
                                  onClick={() => handleSend(p.id)}
                                  disabled={sending === p.id}
                                  className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                >
                                  {sending === p.id ? 'Sending...' : 'Send'}
                                </button>
                              </>
                            )}
                            {p.status === 'accepted' && !p.converted_to_invoice_id && (
                              <button
                                onClick={() => handleConvert(p.id)}
                                disabled={converting === p.id}
                                className="text-xs text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                              >
                                {converting === p.id ? 'Converting...' : 'Convert to Invoice'}
                              </button>
                            )}
                            {p.converted_to_invoice_id && (
                              <Link href={`/invoices/${p.converted_to_invoice_id}`} className="text-xs text-emerald-600 hover:text-emerald-800">
                                View Invoice
                              </Link>
                            )}
                            {['sent', 'viewed'].includes(p.status) && (
                              <button
                                onClick={() => handleSend(p.id)}
                                disabled={sending === p.id}
                                className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
                              >
                                Resend
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredProposals.map((p) => (
                  <div key={p.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm">{p.proposal_number}</div>
                        <div className="text-xs text-gray-500">{p.title}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[p.status]}`}>
                        {statusLabels[p.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-gray-600">{p.clients?.name || 'Unknown'}</span>
                      <span className="font-semibold">{currency(p.amount_cents)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.status === 'draft' && (
                        <>
                          <Link href={`/dashboard/proposals/${p.id}/edit`} className="text-xs text-gray-600">
                            Edit
                          </Link>
                          <button
                            onClick={() => handleSend(p.id)}
                            disabled={sending === p.id}
                            className="text-xs text-blue-600 disabled:opacity-50"
                          >
                            {sending === p.id ? 'Sending...' : 'Send'}
                          </button>
                        </>
                      )}
                      {p.status === 'accepted' && !p.converted_to_invoice_id && (
                        <button
                          onClick={() => handleConvert(p.id)}
                          disabled={converting === p.id}
                          className="text-xs text-emerald-600 disabled:opacity-50"
                        >
                          {converting === p.id ? 'Converting...' : 'Convert'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-xs text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
