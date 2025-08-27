'use client';

import useSWR from 'swr';
import type { Note } from '@/types/client_detail';
import { useState } from 'react';
import { prettyDate } from '@/lib/ui';

export default function ClientNotes({ clientId }: { clientId: string }) {
  const { data, mutate } = useSWR<{ notes: Note[] }>(
    `/api/clients/${clientId}/notes`,
    (u: string) => fetch(u).then((r) => r.json())
  );
  const [text, setText] = useState('');

  async function addNote() {
    if (!text.trim()) return;
    await fetch(`/api/clients/${clientId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    });
    setText('');
    mutate();
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Delete this note?')) return;
    await fetch(`/api/clients/${clientId}/notes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteId }),
    });
    mutate();
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
      <h2 className="text-lg font-semibold">Notes</h2>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <button onClick={addNote} className="rounded-lg border px-3 py-2 hover:bg-gray-50">Add</button>
      </div>

      <ul className="space-y-2">
        {data?.notes?.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className="text-sm">{n.body}</div>
              <div className="text-xs text-gray-500 mt-1">{prettyDate(n.created_at)}</div>
            </div>
            <button
              onClick={() => deleteNote(n.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
