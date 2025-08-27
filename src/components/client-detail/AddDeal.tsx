'use client';

import { useState } from 'react';

type Props = {
  clientId: string;
  onCreated?: (deal: { id: string; title: string; value_cents: number }) => void;
};

export default function AddDeal({ clientId, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [amountUsd, setAmountUsd] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) return setErr('Title is required');
    const dollars = Number.parseFloat(amountUsd || '0');
    if (Number.isNaN(dollars) || dollars < 0) return setErr('Amount must be a number ≥ 0');

    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), value_cents: Math.round(dollars * 100) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create deal');
      onCreated?.(json.deal);
      setTitle('');
      setAmountUsd('');
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message || 'Error creating deal');
      } else {
        setErr('Error creating deal');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-center">
      <input
        className="w-1/2 rounded border px-3 py-2 text-sm"
        placeholder="Deal title (e.g., CRM build)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="w-32 rounded border px-3 py-2 text-sm"
        placeholder="Amount ($)"
        inputMode="decimal"
        value={amountUsd}
        onChange={(e) => setAmountUsd(e.target.value)}
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-emerald-600 px-3 py-2 text-white text-sm disabled:opacity-60"
      >
        {loading ? 'Adding…' : 'Add deal'}
      </button>
      {err ? <span className="text-sm text-red-600">{err}</span> : null}
    </form>
  );
}
