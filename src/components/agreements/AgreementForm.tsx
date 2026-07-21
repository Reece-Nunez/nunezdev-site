'use client';

/**
 * Shared create/edit form for agreements. Both /dashboard/agreements/new and
 * /dashboard/agreements/[id]/edit render this so the two screens can't drift.
 * The page owns persistence (POST vs PATCH + redirect); this component owns the
 * fields, the template loader, and the sections editor.
 */

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import type { AgreementSection } from '@/types/agreements';
import {
  AGREEMENT_TEMPLATES,
  fillTemplate,
  getAgreementTemplate,
  TEMPLATE_DEFAULT_VARS,
} from '@/lib/agreements/templates';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface AgreementFormData {
  client_id: string;
  title: string;
  summary: string;
  sections: AgreementSection[];
  valid_until: string;
  require_signature: boolean;
  internal_notes: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
}

export function emptyAgreementForm(): AgreementFormData {
  return {
    client_id: '',
    title: '',
    summary: '',
    sections: [{ heading: '', body: '' }],
    valid_until: '',
    require_signature: true,
    internal_notes: '',
  };
}

interface AgreementFormProps {
  heading: string;
  submitLabel: string;
  submittingLabel: string;
  initialData?: AgreementFormData;
  onSubmit: (data: AgreementFormData) => Promise<void>;
}

export default function AgreementForm({
  heading,
  submitLabel,
  submittingLabel,
  initialData,
  onSubmit,
}: AgreementFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: clientsData } = useSWR('/api/clients', fetcher);
  const clients: Client[] = clientsData?.clients || [];

  const [formData, setFormData] = useState<AgreementFormData>(initialData ?? emptyAgreementForm());
  const [templateId, setTemplateId] = useState('');

  const loadTemplate = (id: string) => {
    setTemplateId(id);
    if (!id) return;
    const tmpl = getAgreementTemplate(id);
    if (!tmpl) return;
    const clientName = clients.find((c) => c.id === formData.client_id)?.name || '{{CLIENT_NAME}}';
    const filled = fillTemplate(tmpl, { CLIENT_NAME: clientName, ...TEMPLATE_DEFAULT_VARS });
    setFormData((prev) => ({
      ...prev,
      title: filled.title,
      summary: filled.summary,
      sections: filled.sections.length ? filled.sections : prev.sections,
    }));
  };

  const updateSection = (index: number, field: keyof AgreementSection, value: string) => {
    setFormData((prev) => {
      const sections = [...prev.sections];
      sections[index] = { ...sections[index], [field]: value };
      return { ...prev, sections };
    });
  };

  const addSection = () => {
    setFormData((prev) => ({ ...prev, sections: [...prev.sections, { heading: '', body: '' }] }));
  };

  const removeSection = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.length <= 1 ? prev.sections : prev.sections.filter((_, i) => i !== index),
    }));
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    setFormData((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.sections.length) return prev;
      const sections = [...prev.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...prev, sections };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.client_id) {
      setError('Please select a client');
      return;
    }
    if (!formData.title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (formData.sections.every((s) => !s.heading.trim() && !s.body.trim())) {
      setError('Add at least one section with a heading or body');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        ...formData,
        sections: formData.sections.filter((s) => s.heading.trim() || s.body.trim()),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agreement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-3 py-4 sm:p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/agreements" className="text-emerald-600 hover:underline text-sm mb-4 inline-block">
        ← Back to Agreements
      </Link>
      <h1 className="text-2xl font-bold mb-6">{heading}</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <label className="block text-sm font-semibold text-amber-900 mb-1">Start from a template</label>
        <p className="text-xs text-amber-700 mb-2">
          Loads a full draft into the fields below. Pick the client first so their name fills in
          automatically, then edit any wording before sending.
        </p>
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={templateId}
          onChange={(e) => loadTemplate(e.target.value)}
        >
          <option value="">Blank agreement</option>
          {AGREEMENT_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold mb-3">Client</h2>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={formData.client_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, client_id: e.target.value }))}
            required
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company ? `(${c.company})` : ''} - {c.email}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-4">
          <h2 className="font-semibold">Agreement Details</h2>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Title *</label>
            <input
              type="text"
              className="w-full rounded-lg border px-3 py-2"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Partnership Terms Sheet — Custom Subscription Platform"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Summary / standfirst</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2"
              rows={3}
              value={formData.summary}
              onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
              placeholder="Short intro rendered under the title..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Valid Until (optional)</label>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2"
                value={formData.valid_until}
                onChange={(e) => setFormData((prev) => ({ ...prev, valid_until: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Sections</h2>
            <span className="text-xs text-gray-400">Use &quot;• &quot; or &quot;- &quot; at the start of a line for bullets</span>
          </div>

          <div className="space-y-4">
            {formData.sections.map((section, index) => (
              <div key={index} className="rounded-lg border border-gray-200 p-3 bg-gray-50/60">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
                    placeholder="Section heading"
                    value={section.heading}
                    onChange={(e) => updateSection(index, 'heading', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    className="px-2 py-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, 1)}
                    disabled={index === formData.sections.length - 1}
                    className="px-2 py-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  {formData.sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSection(index)}
                      className="px-2 py-1 text-red-500 hover:bg-red-50 rounded"
                      title="Remove section"
                    >
                      ×
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                  rows={5}
                  placeholder="Section body..."
                  value={section.body}
                  onChange={(e) => updateSection(index, 'body', e.target.value)}
                />
              </div>
            ))}
          </div>

          <button type="button" onClick={addSection} className="mt-3 text-sm text-emerald-600 hover:text-emerald-800">
            + Add Section
          </button>
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.require_signature}
              onChange={(e) => setFormData((prev) => ({ ...prev, require_signature: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Require the client&apos;s signature</span>
          </label>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Internal notes (never shown to the client)</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2"
              rows={2}
              value={formData.internal_notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, internal_notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/dashboard/agreements" className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? submittingLabel : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
