'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatPhoneInputAsTyped } from '@/lib/phone';
import { useToast } from '@/components/ui/Toast';

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
  const { showToast, ToastContainer } = useToast();
  const [values, setValues] = useState<FormState>({
    status: 'Lead',
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

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

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data?.error || 'Failed to create client', 'error');
        return;
      }

      showToast('Client created', 'success');
      router.push(`/dashboard/clients/${data.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create client', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-3 py-4 sm:p-6 max-w-2xl">
      <ToastContainer />
      <div className="mb-4">
        <Link href="/dashboard/clients" className="text-sm text-blue-600 hover:underline">
          ← Back to clients
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-1">New Client</h1>
      <p className="text-sm text-gray-600 mb-6">
        All fields are optional. You can fill in more details later.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4">
          <label className="text-sm">
            <div className="text-gray-700 mb-1">Name</div>
            <input
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={values.name ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="e.g., Jane Doe"
              autoFocus
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-700 mb-1">Email</div>
            <input
              type="email"
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={values.email ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              placeholder="jane@example.com"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-700 mb-1">Phone</div>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={values.phone ?? ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, phone: formatPhoneInputAsTyped(e.target.value) }))
              }
              placeholder="(555) 123-4567"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-700 mb-1">Company</div>
            <input
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={values.company ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))}
              placeholder="Acme, Inc."
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-700 mb-1">Status</div>
            <select
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
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
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={values.tags ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, tags: e.target.value }))}
              placeholder="comma, separated, tags"
            />
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Client'}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
