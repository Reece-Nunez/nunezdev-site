'use client';

import { useState } from 'react';

type Invoice = {
  id: string;
  amount_cents: number;
  description?: string;
  days_until_due?: number;
  hosted_invoice_url?: string;
  // Add other fields as needed based on your API response
};

type Props = {
  clientId: string;
  onCreated?: (invoice: Invoice) => void;
};

export default function AddInvoice({ clientId, onCreated }: Props) {
  const [amountUsd, setAmountUsd] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);
  const [scopeNotes, setScopeNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [requireSig, setRequireSig] = useState(true);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccessLink(null);

    const dollars = Number.parseFloat(amountUsd || '');
    if (Number.isNaN(dollars) || dollars <= 0) return setErr('Amount must be a number > 0');

    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: Math.round(dollars * 100),
          description: description || undefined,
          days_until_due: days || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create invoice');
      onCreated?.(json.invoice);
      setSuccessLink(json.hosted_invoice_url || null);
      setAmountUsd('');
      setDescription('');
      setDays(7);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message || 'Error creating invoice');
      } else {
        setErr('Error creating invoice');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-center">
      <input
        className="w-28 rounded border px-3 py-2 text-sm"
        placeholder="Amount ($)"
        inputMode="decimal"
        value={amountUsd}
        onChange={(e) => setAmountUsd(e.target.value)}
      />
      <input
        className="flex-1 min-w-[180px] rounded border px-3 py-2 text-sm"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        type="number"
        min={1}
        className="w-28 rounded border px-3 py-2 text-sm"
        value={days}
        onChange={(e) => setDays(parseInt(e.target.value || '7', 10))}
        title="Days until due"
      />
      <textarea
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="Scope notes (visible before payment)"
        value={scopeNotes}
        onChange={(e) => setScopeNotes(e.target.value)}
      />

      <textarea
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="Terms & conditions"
        value={terms}
        onChange={(e) => setTerms(e.target.value)}
      />

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={requireSig} onChange={(e) => setRequireSig(e.target.checked)} />
        Require signature before payment
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-indigo-600 px-3 py-2 text-white text-sm disabled:opacity-60"
      >
        {loading ? 'Creating…' : 'Create invoice'}
      </button>
      {err ? <span className="text-sm text-red-600">{err}</span> : null}
      {successLink ? (
        <a
          href={successLink}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-emerald-700 underline"
        >
          Open hosted invoice →
        </a>
      ) : null}
    </form>
  );
}
