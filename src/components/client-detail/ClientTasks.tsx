'use client';

import useSWR from 'swr';
import { useState } from 'react';
import type { Task } from '@/types/client_detail';
import { prettyDate } from '@/lib/ui';

export default function ClientTasks({ clientId }: { clientId: string }) {
  const { data, mutate } = useSWR<{ tasks: Task[] }>(`/api/clients/${clientId}/tasks`, (u: string) => fetch(u).then(r => r.json()));
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<string>('');

  async function addTask() {
    if (!title.trim()) return;
    await fetch(`/api/clients/${clientId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, due_at: due || null }),
    });
    setTitle(''); setDue('');
    mutate();
  }

  async function toggleTask(t: Task) {
    await fetch(`/api/clients/${clientId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, done: !t.done }),
    });
    mutate();
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
      <h2 className="text-lg font-semibold">Tasks</h2>
      <div className="flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up…" className="flex-1 rounded-lg border px-3 py-2" />
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg border px-3 py-2" />
        <button onClick={addTask} className="rounded-lg border px-3 py-2 hover:bg-gray-50">Add</button>
      </div>
      <ul className="space-y-2">
        {data?.tasks?.map(t => (
          <li key={t.id} className="rounded-lg border p-3 flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} />
              <div>
                <div className={"text-sm " + (t.done ? "line-through text-gray-400" : "")}>{t.title}</div>
                <div className="text-xs text-gray-500 mt-1">{t.due_at ? `Due ${prettyDate(t.due_at)}` : 'No due date'}</div>
              </div>
            </label>
            <span className={"text-xs rounded px-2 py-1 " + (t.done ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700")}>
              {t.done ? "Done" : "Open"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
