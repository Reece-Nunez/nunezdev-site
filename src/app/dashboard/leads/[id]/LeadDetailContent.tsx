'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
  source: string;
  lead_source: string | null;
  tags: string[] | null;
  message: string | null;
  project_type: string | null;
  budget: string | null;
  timeline: string | null;
  notes: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  last_contact: string | null;
  next_followup: string | null;
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Won (Converted)' },
  { value: 'lost', label: 'Lost' },
];

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  nurturing: 'bg-purple-50 text-purple-700 border-purple-200',
  qualified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  lost: 'bg-gray-100 text-gray-600 border-gray-200',
};

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function LeadDetailContent({ lead: initialLead }: { lead: Lead }) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [notes, setNotes] = useState(initialLead.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [converting, setConverting] = useState(false);
  const [, startTransition] = useTransition();

  async function updateStatus(newStatus: string) {
    const prev = lead.status;
    setLead({ ...lead, status: newStatus });
    const toastId = toast.loading('Updating status...');
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      toast.success(`Status updated to ${newStatus}`, { id: toastId });
      startTransition(() => router.refresh());
    } catch (err) {
      setLead({ ...lead, status: prev });
      toast.error(err instanceof Error ? err.message : 'Update failed', { id: toastId });
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    const toastId = toast.loading('Saving notes...');
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      toast.success('Notes saved', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed', { id: toastId });
    } finally {
      setSavingNotes(false);
    }
  }

  async function convertToClient() {
    if (lead.client_id) {
      router.push(`/dashboard/clients/${lead.client_id}`);
      return;
    }

    setConverting(true);
    const toastId = toast.loading('Converting to client...');
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Convert failed');
      toast.success('Lead converted to client!', { id: toastId });
      router.push(`/dashboard/clients/${data.clientId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Convert failed', { id: toastId });
      setConverting(false);
    }
  }

  return (
    <div className="px-3 py-4 sm:p-6 max-w-5xl space-y-6">
      {/* Breadcrumb + back */}
      <div>
        <Link
          href="/dashboard/leads"
          className="text-sm text-emerald-700 hover:underline inline-flex items-center gap-1"
        >
          &larr; Back to leads
        </Link>
      </div>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{lead.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {lead.email}
            {lead.company ? ` · ${lead.company}` : ''}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Received {formatDateTime(lead.created_at)}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Convert button — primary action when lead is hot */}
          {lead.client_id ? (
            <Link
              href={`/dashboard/clients/${lead.client_id}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 text-sm font-medium hover:bg-emerald-200 transition-colors"
            >
              View Client &rarr;
            </Link>
          ) : (
            <button
              onClick={convertToClient}
              disabled={converting}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {converting ? 'Converting...' : 'Convert to Client'}
            </button>
          )}
        </div>
      </header>

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <span className="text-sm text-gray-500">Status:</span>
        <span
          className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${
            STATUS_STYLES[lead.status] || 'bg-gray-50 text-gray-700 border-gray-200'
          }`}
        >
          {lead.status}
        </span>
        <select
          value={lead.status}
          onChange={(e) => updateStatus(e.target.value)}
          className="ml-auto text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Contact + qualifying details */}
        <div className="lg:col-span-2 space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Contact
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Field label="Email">
                <a href={`mailto:${lead.email}`} className="text-emerald-700 hover:underline">
                  {lead.email}
                </a>
              </Field>
              <Field label="Phone">
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="text-emerald-700 hover:underline">
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">Not provided</span>
                )}
              </Field>
              <Field label="Company">{lead.company || <Dim />}</Field>
              <Field label="Form source">{lead.lead_source || lead.source}</Field>
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Project details
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <Field label="Type">{lead.project_type || <Dim />}</Field>
              <Field label="Budget">{lead.budget || <Dim />}</Field>
              <Field label="Timeline">{lead.timeline || <Dim />}</Field>
            </dl>
            {lead.message && (
              <div className="mt-5">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Their message
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border border-gray-100">
                  {lead.message}
                </p>
              </div>
            )}
          </section>

          {/* Internal notes */}
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Internal notes
              </h2>
              <button
                onClick={saveNotes}
                disabled={savingNotes || notes === (lead.notes || '')}
                className="text-xs px-3 py-1 rounded-md bg-gray-900 text-white disabled:opacity-50 hover:bg-gray-700 transition-colors"
              >
                {savingNotes ? 'Saving...' : 'Save'}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Call notes, follow-up reminders, anything you want to remember about this lead..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </section>
        </div>

        {/* Right — Meta + tags */}
        <aside className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Activity
            </h2>
            <dl className="space-y-3 text-sm">
              <Field label="Created">{formatDateTime(lead.created_at)}</Field>
              <Field label="Last contact">{formatDateTime(lead.last_contact)}</Field>
              <Field label="Next follow-up">{formatDateTime(lead.next_followup)}</Field>
              <Field label="Updated">{formatDateTime(lead.updated_at)}</Field>
            </dl>
          </section>

          {lead.tags && lead.tags.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                Tags
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-gray-900">{children}</dd>
    </div>
  );
}

function Dim() {
  return <span className="text-gray-400">—</span>;
}
