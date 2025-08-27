'use client';

import useSWR from 'swr';
import { useState } from 'react';
import type { DealLite } from '@/types/client_detail';
import { currency, prettyDate } from '@/lib/ui';

export default function ClientDeals({ clientId }: { clientId: string }) {
  const { data, mutate } = useSWR<{ deals: DealLite[] }>(`/api/clients/${clientId}/deals`, (u: string) => fetch(u).then(r => r.json()));
  const [title, setTitle] = useState('');
  const [value, setValue] = useState<string>('');

  async function addDeal() {
    if (!title.trim()) return;
    const value_cents = Math.round((Number(value || 0)) * 100);
    await fetch(`/api/clients/${clientId}/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, value_cents }),
    });
    setTitle(''); setValue('');
    mutate();
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Deals</h2>
        <a href="/deals" className="text-sm text-blue-600 hover:underline">Open pipeline</a>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New website build…" className="flex-1 rounded-lg border px-3 py-2" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value (USD)" className="w-40 rounded-lg border px-3 py-2" />
        <button onClick={addDeal} className="rounded-lg border px-3 py-2 hover:bg-gray-50">Add Deal</button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr><th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2">Created</th></tr></thead>
          <tbody>
            {data?.deals?.map(d => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2">{d.title}</td>
                <td className="px-3 py-2">{d.stage}</td>
                <td className="px-3 py-2 text-right">{currency(d.value_cents)}</td>
                <td className="px-3 py-2">{prettyDate(d.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
