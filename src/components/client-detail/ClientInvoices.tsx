'use client';

import useSWR from 'swr';
import { useState } from 'react';
import type { InvoiceLite } from '@/types/client_detail';
import { currency, prettyDate } from '@/lib/ui';

export default function ClientInvoices({ clientId }: { clientId: string }) {
  const { data, mutate } = useSWR<{ invoices: InvoiceLite[] }>(
    `/api/clients/${clientId}/invoices`,
    (u: string) => fetch(u).then(r => r.json())
  );

  // ---- Inline StatusBadge (same as your invoices page) ----
  type RowStatus = 'draft' | 'sent' | 'paid' | 'void' | 'overdue';
  function StatusBadge({ s }: { s: RowStatus }) {
    const map: Record<RowStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-indigo-100 text-indigo-700',
      paid: 'bg-emerald-100 text-emerald-700',
      void: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-700',
    };
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${map[s]}`}>{s}</span>;
  }
  // ---------------------------------------------------------

  const [amount, setAmount] = useState<string>('');
  const [desc, setDesc] = useState<string>('Services');
  const [days, setDays] = useState<string>('7');
  const [sending, setSending] = useState(false);

  async function createInvoice() {
    const amount_cents = Math.round((Number(amount || 0)) * 100);
    if (!amount_cents) return;
    setSending(true);
    const res = await fetch(`/api/clients/${clientId}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_cents,
        description: desc,
        days_until_due: Number(days || 7),
      }),
    });
    setSending(false);
    const j = await res.json();
    if (j?.hosted_invoice_url) window.open(j.hosted_invoice_url, '_blank');
    setAmount('');
    setDesc('Services');
    mutate();
  }

  function DeleteInvoiceButton({
    clientId,
    invoiceId,
    onDone,
  }: {
    clientId: string;
    invoiceId: string;
    onDone: () => void;
  }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function handleDelete() {
      if (!confirm('Delete this invoice? This will void/delete it in Stripe.')) return;
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(`/api/clients/${clientId}/invoices`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: invoiceId, hard: true }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Delete failed');
        onDone();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Delete failed');
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-sm text-red-600 hover:underline disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
        {err ? <span className="text-xs text-red-600">{err}</span> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Invoices</h2>
        <a href="/dashboard/invoices" className="text-sm text-blue-600 hover:underline">
          Open invoices
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount ($)"
          className="w-40 rounded-lg border px-3 py-2"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="flex-1 min-w-[180px] rounded-lg border px-3 py-2"
        />
        <input
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="7"
          className="w-28 rounded-lg border px-3 py-2"
          title="Days until due"
        />
        <button
          onClick={createInvoice}
          disabled={sending}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:opacity-90 disabled:opacity-60"
        >
          {sending ? 'Creating…' : 'Create invoice'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto text-sm">
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col style={{ width: '110px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Issued</th>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.invoices?.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="px-3 py-2">
                  <StatusBadge s={inv.status as RowStatus} />
                </td>
                <td className="px-3 py-2 text-right">{currency(inv.amount_cents)}</td>
                <td className="px-3 py-2">{prettyDate(inv.issued_at)}</td>
                <td className="px-3 py-2">{prettyDate(inv.due_at)}</td>
                <td className="px-3 py-2 text-right">
                  <DeleteInvoiceButton clientId={clientId} invoiceId={inv.id} onDone={mutate} />
                </td>
              </tr>
            ))}
            {!data?.invoices?.length && (
              <tr className="border-t">
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
