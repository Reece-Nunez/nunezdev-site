'use client';

import useSWR from 'swr';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useToast, useConfirm } from '@/components/ui/Toast';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { currency } from '@/lib/ui';
import { buildProposalShareMessage } from '@/lib/proposalShareMessage';
import CopyProposalLinkButton from '@/components/proposals/CopyProposalLinkButton';
import CustomProposalsPanel from '@/components/proposals/CustomProposalsPanel';

const fetcher = (u: string) => fetch(u).then(r => r.json());

type SendChannel = 'email' | 'sms' | 'both';

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
  access_token?: string;
  clients?: {
    id: string;
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
    sms_opted_out_at?: string | null;
  } | null;
}

const statusTone: Record<string, BadgeTone> = {
  draft: 'neutral',
  sent: 'info',
  viewed: 'purple',
  accepted: 'success',
  rejected: 'danger',
  expired: 'warning'
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired'
};

/**
 * Small "Send ▾" split menu offering Email / Text / Both. Open state is owned
 * by the parent (only one row's menu open at a time). A transparent full-screen
 * backdrop closes it on any outside click.
 */
function SendMenu({
  label,
  isOpen,
  disabled,
  onToggle,
  onChoose,
}: {
  label: string;
  isOpen: boolean;
  disabled: boolean;
  onToggle: () => void;
  onChoose: (channel: SendChannel) => void;
}) {
  // Anchor the menu with position:fixed computed from the button rect so it
  // escapes the table's overflow container (which otherwise clips it and forces
  // a stray scrollbar). Recomputed each open.
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const handleToggle = () => {
    if (!isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    }
    onToggle();
  };

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={handleToggle}
        disabled={disabled}
        className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
      >
        {disabled ? 'Sending…' : `${label} ▾`}
      </button>
      {isOpen && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div
            className="fixed z-50 w-32 rounded-lg border bg-white py-1 shadow-lg"
            style={{ top: pos.top, right: pos.right }}
          >
            <button
              onClick={() => onChoose('email')}
              className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              Email
            </button>
            <button
              onClick={() => onChoose('sms')}
              className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              Text
            </button>
            <button
              onClick={() => onChoose('both')}
              className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              Text + Email
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ProposalsPage() {
  const { data, error, mutate } = useSWR<{ proposals: Proposal[] }>('/api/proposals', fetcher);
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmContainer } = useConfirm();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sending, setSending] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  // Which row's "Send ▾" menu is open (null = none).
  const [sendMenuFor, setSendMenuFor] = useState<string | null>(null);
  // SMS/Both confirm modal state.
  const [smsModal, setSmsModal] = useState<{ proposal: Proposal; channel: 'sms' | 'both' } | null>(null);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsBody, setSmsBody] = useState('');

  const proposals = data?.proposals ?? [];

  const filteredProposals = statusFilter === 'all'
    ? proposals
    : proposals.filter(p => p.status === statusFilter);

  // Surface per-channel outcomes from the send API as individual toasts.
  const reportSendResult = (json: {
    email?: { ok: boolean; error?: string };
    sms?: { ok: boolean; error?: string; to?: string };
  }) => {
    if (json.email) {
      if (json.email.ok) showToast('Proposal emailed', 'success');
      else showToast(`Email failed: ${json.email.error ?? 'unknown error'}`, 'error');
    }
    if (json.sms) {
      if (json.sms.ok) showToast(`Proposal texted${json.sms.to ? ` to ${json.sms.to}` : ''}`, 'success');
      else showToast(`Text failed: ${json.sms.error ?? 'unknown error'}`, 'error');
    }
  };

  const handleSend = async (
    id: string,
    channel: SendChannel,
    opts?: { to?: string; bodyOverride?: string },
  ) => {
    setSending(id);
    try {
      const res = await fetch(`/api/proposals/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, to: opts?.to, bodyOverride: opts?.bodyOverride }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      reportSendResult(json);
      mutate();
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send proposal', 'error');
      return false;
    } finally {
      setSending(null);
    }
  };

  // Pick a channel from the row menu. Email sends immediately; Text/Both open a
  // modal so the operator can confirm the phone and preview the message.
  const chooseChannel = (p: Proposal, channel: SendChannel) => {
    setSendMenuFor(null);
    if (channel === 'email') {
      handleSend(p.id, 'email');
      return;
    }
    const url = typeof window !== 'undefined' ? `${window.location.origin}/proposal/${p.access_token}` : '';
    setSmsPhone(p.clients?.phone || '');
    setSmsBody(
      buildProposalShareMessage({
        clientName: p.clients?.name,
        proposalTitle: p.title,
        amountCents: p.amount_cents,
        url,
      }),
    );
    setSmsModal({ proposal: p, channel });
  };

  const submitSmsModal = async () => {
    if (!smsModal) return;
    if (!smsPhone.trim()) {
      showToast('Please enter a phone number', 'error');
      return;
    }
    const ok = await handleSend(smsModal.proposal.id, smsModal.channel, {
      to: smsPhone.trim(),
      bodyOverride: smsBody.trim() || undefined,
    });
    if (ok) setSmsModal(null);
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
    const confirmed = await confirm({ title: 'Delete Proposal', message: 'Are you sure you want to delete this proposal?', confirmLabel: 'Delete', variant: 'danger' });
    if (!confirmed) return;
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
      <ConfirmContainer />
      <div className="px-3 py-4 sm:p-6 space-y-4 max-w-full min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Proposals</h1>
          <Link
            href="/dashboard/proposals/new"
            className="rounded-lg px-4 py-2 text-white text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-700"
          >
            + New Proposal
          </Link>
        </div>

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
                          <Badge tone={statusTone[p.status] ?? 'neutral'}>{statusLabels[p.status]}</Badge>
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
                                <SendMenu
                                  label="Send"
                                  isOpen={sendMenuFor === p.id}
                                  disabled={sending === p.id}
                                  onToggle={() => setSendMenuFor(sendMenuFor === p.id ? null : p.id)}
                                  onChoose={(channel) => chooseChannel(p, channel)}
                                />
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
                              <Link href={`/dashboard/invoices/${p.converted_to_invoice_id}`} className="text-xs text-emerald-600 hover:text-emerald-800">
                                View Invoice
                              </Link>
                            )}
                            {['sent', 'viewed'].includes(p.status) && (
                              <SendMenu
                                label="Resend"
                                isOpen={sendMenuFor === p.id}
                                disabled={sending === p.id}
                                onToggle={() => setSendMenuFor(sendMenuFor === p.id ? null : p.id)}
                                onChoose={(channel) => chooseChannel(p, channel)}
                              />
                            )}
                            {p.access_token && !['rejected', 'expired'].includes(p.status) && (
                              <CopyProposalLinkButton
                                proposalId={p.id}
                                token={p.access_token}
                                status={p.status}
                                onMarkedSent={() => mutate()}
                              />
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
                      <Badge tone={statusTone[p.status] ?? 'neutral'}>{statusLabels[p.status]}</Badge>
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
                          <SendMenu
                            label="Send"
                            isOpen={sendMenuFor === p.id}
                            disabled={sending === p.id}
                            onToggle={() => setSendMenuFor(sendMenuFor === p.id ? null : p.id)}
                            onChoose={(channel) => chooseChannel(p, channel)}
                          />
                        </>
                      )}
                      {['sent', 'viewed'].includes(p.status) && (
                        <SendMenu
                          label="Resend"
                          isOpen={sendMenuFor === p.id}
                          disabled={sending === p.id}
                          onToggle={() => setSendMenuFor(sendMenuFor === p.id ? null : p.id)}
                          onChoose={(channel) => chooseChannel(p, channel)}
                        />
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
                      {p.access_token && !['rejected', 'expired'].includes(p.status) && (
                        <CopyProposalLinkButton
                          proposalId={p.id}
                          token={p.access_token}
                          status={p.status}
                          onMarkedSent={() => mutate()}
                        />
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

        <CustomProposalsPanel showToast={showToast} />
      </div>

      {smsModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => sending !== smsModal.proposal.id && setSmsModal(null)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {smsModal.channel === 'both' ? 'Send Text + Email' : 'Send via Text'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {smsModal.channel === 'both'
                    ? `Texts the number below and emails ${smsModal.proposal.clients?.email || 'the client'}`
                    : "Twilio SMS to the client's phone"}
                </p>
              </div>
              <button
                onClick={() => sending !== smsModal.proposal.id && setSmsModal(null)}
                className="text-gray-400 hover:text-gray-600"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone number</label>
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="(405) 555-1234"
                  disabled={sending === smsModal.proposal.id}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                />
                {!smsModal.proposal.clients?.phone && (
                  <p className="text-xs text-amber-600 mt-1">
                    No phone on file for this client. Type one above or add it to the client record for next time.
                  </p>
                )}
                {smsModal.proposal.clients?.sms_opted_out_at && (
                  <p className="text-xs text-red-600 mt-1">
                    This client replied STOP and can&apos;t be texted. The send will be refused.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Message <span className="text-gray-400">({smsBody.length} chars)</span>
                </label>
                <textarea
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  rows={4}
                  disabled={sending === smsModal.proposal.id}
                  maxLength={800}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Keep the proposal link in the message. Twilio charges per 160-char segment.
                  {smsBody.length > 160 && (
                    <span className="text-amber-600">
                      {' '}This message will be sent as {Math.ceil(smsBody.length / 160)} segments.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => setSmsModal(null)}
                disabled={sending === smsModal.proposal.id}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitSmsModal}
                disabled={sending === smsModal.proposal.id}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sending === smsModal.proposal.id
                  ? 'Sending…'
                  : smsModal.channel === 'both'
                    ? 'Send Text + Email'
                    : 'Send Text'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
