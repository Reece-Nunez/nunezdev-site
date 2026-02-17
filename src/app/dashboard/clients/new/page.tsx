'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type FormState = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: 'Lead' | 'Prospect' | 'Active' | 'Past';
  tags?: string; // comma-separated in UI
};

export default function NewClientPage() {
  const router = useRouter();
  const [values, setValues] = useState<FormState>({
    status: 'Lead',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Convert "a, b, c" => ["a","b","c"]
    const tags =
      values.tags
        ?.split(',')
        .map((t) => t.trim())
        .filter(Boolean) ?? [];

    const payload = {
      name: values.name,        // optional (server will default if empty)
      email: values.email,
      phone: values.phone,
      company: values.company,
      status: values.status ?? 'Lead',
      tags,                     // array
    };

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data?.error || 'Failed to create client');
      return;
    }

    // Go to detail page
    router.push(`/dashboard/clients/${data.id}`);
  }

  return (
    <div className="max-w-2xl my-36">
      <h1 className="text-2xl font-semibold mb-3">New Client</h1>
      <p className="text-sm text-gray-600 mb-6">
        All fields are optional. You can fill in more details later.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <label className="text-sm">
            <div className="text-gray-700 mb-1">Name (optional)</div>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={values.name ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="e.g., Jane Doe"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-700 mb-1">Email</div>
            <input
              type="email"
              className="w-full rounded-lg border px-3 py-2"
              value={values.email ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              placeholder="jane@example.com"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-700 mb-1">Phone</div>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={values.phone ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
              placeholder="(555) 123-4567"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-700 mb-1">Company</div>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={values.company ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))}
              placeholder="Acme, Inc."
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-700 mb-1">Status</div>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={values.status ?? 'Lead'}
              onChange={(e) =>
                setValues((v) => ({ ...v, status: e.target.value as FormState['status'] }))
              }
            >
              <option>Lead</option>
              <option>Prospect</option>
              <option>Active</option>
              <option>Past</option>
            </select>
          </label>

          <label className="text-sm">
            <div className="text-gray-700 mb-1">Tags</div>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={values.tags ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, tags: e.target.value }))}
              placeholder="comma, separated, tags"
            />
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Client'}
          </button>

          <button
            type="button"
            onClick={() => history.back()}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
