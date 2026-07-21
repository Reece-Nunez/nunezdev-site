'use client';

import useSWR from 'swr';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useToast, useConfirm } from '@/components/ui/Toast';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { buildAgreementShareMessage } from '@/lib/agreements/share';
import CopyAgreementLinkButton from '@/components/agreements/CopyAgreementLinkButton';
import type { Agreement, AgreementStatus } from '@/types/agreements';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type SendChannel = 'email' | 'sms' | 'both';

const statusTone: Record<AgreementStatus, BadgeTone> = {
  draft: 'neutral',
  sent: 'info',
  viewed: 'purple',
  signed: 'warning',
  countersigned: 'success',
  declined: 'danger',
  expired: 'muted',
};

const statusLabels: Record<AgreementStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Client signed',
  countersigned: 'Fully executed',
  declined: 'Declined',
  expired: 'Expired',
};

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
      <button ref={btnRef} onClick={handleToggle} disabled={disabled} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
        {disabled ? 'Sending…' : `${label} ▾`}
      </button>
      {isOpen && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div className="fixed z-50 w-32 rounded-lg border bg-white py-1 shadow-lg" style={{ top: pos.top, right: pos.right }}>
            <button onClick={() => onChoose('email')} className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50">Email</button>
            <button onClick={() => onChoose('sms')} className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50">Text</button>
            <button onClick={() => onChoose('both')} className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50">Text + Email</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AgreementsPage() {
  const { data, error, mutate } = useSWR<{ agreements: Agreement[] }>('/api/agreements', fetcher);
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmContainer } = useConfirm();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sending, setSending] = useState<string | null>(null);
  const [sendMenuFor, setSendMenuFor] = useState<string | null>(null);
  const [smsModal, setSmsModal] = useState<{ agreement: Agreement; channel: 'sms' | 'both' } | null>(null);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsBody, setSmsBody] = useState('');

  const agreements = data?.agreements ?? [];
  const filtered = statusFilter === 'all' ? agreements : agreements.filter((a) => a.status === statusFilter);

  const reportSendResult = (json: {
    email?: { ok: boolean; error?: string };
    sms?: { ok: boolean; error?: string; to?: string };
  }) => {
    if (json.email) {
      if (json.email.ok) showToast('Agreement emailed', 'success');
      else showToast(`Email failed: ${json.email.error ?? 'unknown error'}`, 'error');
    }
    if (json.sms) {
      if (json.sms.ok) showToast(`Agreement texted${json.sms.to ? ` to ${json.sms.to}` : ''}`, 'success');
      else showToast(`Text failed: ${json.sms.error ?? 'unknown error'}`, 'error');
    }
  };

  const handleSend = async (id: string, channel: SendChannel, opts?: { to?: string; bodyOverride?: string }) => {
    setSending(id);
    try {
      const res = await fetch(`/api/agreements/${id}/send`, {
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
      showToast(err instanceof Error ? err.message : 'Failed to send agreement', 'error');
      return false;
    } finally {
      setSending(null);
    }
  };

  const chooseChannel = (a: Agreement, channel: SendChannel) => {
    setSendMenuFor(null);
    if (channel === 'email') {
      handleSend(a.id, 'email');
      return;
    }
    const url = typeof window !== 'undefined' ? `${window.location.origin}/agreement/${a.access_token}` : '';
    setSmsPhone(a.clients?.phone || '');
    setSmsBody(buildAgreementShareMessage({ clientName: a.clients?.name, title: a.title, url }));
    setSmsModal({ agreement: a, channel });
  };

  const submitSmsModal = async () => {
    if (!smsModal) return;
    if (!smsPhone.trim()) {
      showToast('Please enter a phone number', 'error');
      return;
    }
    const ok = await handleSend(smsModal.agreement.id, smsModal.channel, {
      to: smsPhone.trim(),
      bodyOverride: smsBody.trim() || undefined,
    });
    if (ok) setSmsModal(null);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Agreement',
      message: 'Are you sure you want to delete this agreement?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/agreements/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Agreement deleted', 'success');
      mutate();
    } catch {
      showToast('Failed to delete agreement', 'error');
    }
  };

  const stats = {
    draft: agreements.filter((a) => a.status === 'draft').length,
    sent: agreements.filter((a) => ['sent', 'viewed'].includes(a.status)).length,
    signed: agreements.filter((a) => a.status === 'signed').length,
    executed: agreements.filter((a) => a.status === 'countersigned').length,
  };

  const canSend = (a: Agreement) => !['signed', 'countersigned', 'declined'].includes(a.status);

  return (
    <>
      <ToastContainer />
      <ConfirmContainer />
      <div className="px-3 py-4 sm:p-6 space-y-4 max-w-full min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Agreements</h1>
          <Link href="/dashboard/agreements/new" className="rounded-lg px-4 py-2 text-white text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-700">
            + New Agreement
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Draft</div>
            <div className="text-lg font-semibold">{stats.draft}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Out for signature</div>
            <div className="text-lg font-semibold text-blue-600">{stats.sent}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Awaiting counter-sign</div>
            <div className="text-lg font-semibold text-amber-600">{stats.signed}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Fully executed</div>
            <div className="text-lg font-semibold text-emerald-600">{stats.executed}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-3">
          <select className="rounded-lg border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="signed">Client signed</option>
            <option value="countersigned">Fully executed</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          {error ? (
            <div className="p-4 text-red-600">Failed to load agreements</div>
          ) : !data ? (
            <div className="p-4 text-gray-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No agreements found</p>
              <Link href="/dashboard/agreements/new" className="text-emerald-600 hover:underline mt-2 inline-block">
                Create your first agreement
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Agreement</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/agreements/${a.id}`} className="font-medium text-sm text-gray-900 hover:text-emerald-700">
                            {a.agreement_number}
                          </Link>
                          <div className="text-xs text-gray-500 truncate max-w-[240px]">{a.title}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{a.clients?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{a.clients?.company}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone[a.status] ?? 'neutral'}>{statusLabels[a.status]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(a.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/dashboard/agreements/${a.id}`} className="text-xs text-gray-600 hover:text-gray-900">View</Link>
                            {a.status === 'draft' && (
                              <>
                                <Link href={`/dashboard/agreements/${a.id}/edit`} className="text-xs text-gray-600 hover:text-gray-900">Edit</Link>
                                <SendMenu label="Send" isOpen={sendMenuFor === a.id} disabled={sending === a.id} onToggle={() => setSendMenuFor(sendMenuFor === a.id ? null : a.id)} onChoose={(c) => chooseChannel(a, c)} />
                              </>
                            )}
                            {['sent', 'viewed'].includes(a.status) && (
                              <SendMenu label="Resend" isOpen={sendMenuFor === a.id} disabled={sending === a.id} onToggle={() => setSendMenuFor(sendMenuFor === a.id ? null : a.id)} onChoose={(c) => chooseChannel(a, c)} />
                            )}
                            {a.access_token && canSend(a) && (
                              <CopyAgreementLinkButton agreementId={a.id} token={a.access_token} status={a.status} onMarkedSent={() => mutate()} />
                            )}
                            <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filtered.map((a) => (
                  <div key={a.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Link href={`/dashboard/agreements/${a.id}`} className="font-medium text-sm text-gray-900">{a.agreement_number}</Link>
                        <div className="text-xs text-gray-500">{a.title}</div>
                      </div>
                      <Badge tone={statusTone[a.status] ?? 'neutral'}>{statusLabels[a.status]}</Badge>
                    </div>
                    <div className="text-sm text-gray-600 mb-3">{a.clients?.name || 'Unknown'}</div>
                    <div className="flex items-center gap-3">
                      <Link href={`/dashboard/agreements/${a.id}`} className="text-xs text-gray-600">View</Link>
                      {a.status === 'draft' && (
                        <>
                          <Link href={`/dashboard/agreements/${a.id}/edit`} className="text-xs text-gray-600">Edit</Link>
                          <SendMenu label="Send" isOpen={sendMenuFor === a.id} disabled={sending === a.id} onToggle={() => setSendMenuFor(sendMenuFor === a.id ? null : a.id)} onChoose={(c) => chooseChannel(a, c)} />
                        </>
                      )}
                      {['sent', 'viewed'].includes(a.status) && (
                        <SendMenu label="Resend" isOpen={sendMenuFor === a.id} disabled={sending === a.id} onToggle={() => setSendMenuFor(sendMenuFor === a.id ? null : a.id)} onChoose={(c) => chooseChannel(a, c)} />
                      )}
                      {a.access_token && canSend(a) && (
                        <CopyAgreementLinkButton agreementId={a.id} token={a.access_token} status={a.status} onMarkedSent={() => mutate()} />
                      )}
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {smsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => sending !== smsModal.agreement.id && setSmsModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{smsModal.channel === 'both' ? 'Send Text + Email' : 'Send via Text'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {smsModal.channel === 'both'
                    ? `Texts the number below and emails ${smsModal.agreement.clients?.email || 'the client'}`
                    : "Twilio SMS to the client's phone"}
                </p>
              </div>
              <button onClick={() => sending !== smsModal.agreement.id && setSmsModal(null)} className="text-gray-400 hover:text-gray-600" title="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone number</label>
                <input type="tel" value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="(405) 555-1234" disabled={sending === smsModal.agreement.id} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" />
                {!smsModal.agreement.clients?.phone && (
                  <p className="text-xs text-amber-600 mt-1">No phone on file for this client. Type one above or add it to the client record for next time.</p>
                )}
                {smsModal.agreement.clients?.sms_opted_out_at && (
                  <p className="text-xs text-red-600 mt-1">This client replied STOP and can&apos;t be texted. The send will be refused.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message <span className="text-gray-400">({smsBody.length} chars)</span></label>
                <textarea value={smsBody} onChange={(e) => setSmsBody(e.target.value)} rows={4} disabled={sending === smsModal.agreement.id} maxLength={800} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 font-mono" />
                <p className="text-xs text-gray-500 mt-1">
                  Keep the agreement link in the message. Twilio charges per 160-char segment.
                  {smsBody.length > 160 && <span className="text-amber-600"> This message will be sent as {Math.ceil(smsBody.length / 160)} segments.</span>}
                </p>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-2">
              <button onClick={() => setSmsModal(null)} disabled={sending === smsModal.agreement.id} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">Cancel</button>
              <button onClick={submitSmsModal} disabled={sending === smsModal.agreement.id} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {sending === smsModal.agreement.id ? 'Sending…' : smsModal.channel === 'both' ? 'Send Text + Email' : 'Send Text'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
