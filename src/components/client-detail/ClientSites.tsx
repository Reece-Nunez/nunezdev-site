'use client';

import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/ui/Toast';
import type { ClientSite } from '@/types/clients';

const fetcher = (u: string) => fetch(u).then(r => r.json());

type Draft = {
  label: string;
  website_url: string;
  ga4_property_id: string;
  vercel_project_id: string;
  gsc_site_url: string;
};

function fromSite(s: ClientSite): Draft {
  return {
    label: s.label ?? '',
    website_url: s.website_url ?? '',
    ga4_property_id: s.ga4_property_id ?? '',
    vercel_project_id: s.vercel_project_id ?? '',
    gsc_site_url: s.gsc_site_url ?? '',
  };
}

const FIELDS: { key: keyof Omit<Draft, 'label'>; label: string }[] = [
  { key: 'website_url', label: 'Website URL' },
  { key: 'ga4_property_id', label: 'GA4 Property ID' },
  { key: 'vercel_project_id', label: 'Vercel Project ID' },
  { key: 'gsc_site_url', label: 'GSC Site URL' },
];

export default function ClientSites({ clientId }: { clientId: string }) {
  const { data, mutate, isLoading } = useSWR<{ sites: ClientSite[] }>(
    `/api/clients/${clientId}/sites`,
    fetcher,
  );
  const sites = data?.sites || [];
  const { confirm, ConfirmContainer } = useConfirm();

  // Per-site local edits, keyed by site id. Absent => pristine (use server values).
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const effective = (s: ClientSite): Draft => drafts[s.id] ?? fromSite(s);
  const isDirty = (s: ClientSite) => !!drafts[s.id];

  const update = (s: ClientSite, field: keyof Draft, value: string) =>
    setDrafts(prev => ({ ...prev, [s.id]: { ...(prev[s.id] ?? fromSite(s)), [field]: value } }));

  const clearDraft = (id: string) =>
    setDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });

  async function save(s: ClientSite) {
    setBusy(`${s.id}-save`);
    try {
      const res = await fetch(`/api/clients/${clientId}/sites/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(effective(s)),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save site');
      clearDraft(s.id);
      await mutate();
      toast.success('Site saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save site');
    } finally {
      setBusy(null);
    }
  }

  async function detect(s: ClientSite) {
    const url = effective(s).website_url.trim();
    if (!url) { toast.error('Add a Website URL first, then auto-detect.'); return; }
    setBusy(`${s.id}-detect`);
    try {
      const res = await fetch(`/api/clients/${clientId}/detect-integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_url: url }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Detection failed');

      const found: string[] = [];
      const missed: string[] = [];
      const cur = effective(s);
      const next = { ...cur };
      const apply = (field: keyof Draft, value: string | null, name: string, reason?: string) => {
        if (value && !cur[field].trim()) { next[field] = value; found.push(`${name} ${value}`); }
        else if (!value) missed.push(`${name} (${reason || 'not found'})`);
      };
      apply('ga4_property_id', d.ga4_property_id, 'GA4', d.diagnostics?.ga4?.reason);
      apply('vercel_project_id', d.vercel_project_id, 'Vercel', d.diagnostics?.vercel?.reason);
      apply('gsc_site_url', d.gsc_site_url, 'GSC', d.diagnostics?.gsc?.reason);

      if (found.length) {
        setDrafts(prev => ({ ...prev, [s.id]: next }));
        toast.success(`Detected: ${found.join(', ')}. Save to keep.`);
      }
      if (missed.length) toast.error(`Couldn't detect: ${missed.join('; ')}`);
      if (!found.length && !missed.length) toast.success('Integrations already filled in.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Detection failed');
    } finally {
      setBusy(null);
    }
  }

  async function remove(s: ClientSite) {
    const ok = await confirm({
      title: 'Remove site',
      message: `Remove "${s.label}"? Past reports for this site are kept, but it won't be reportable anymore.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(`${s.id}-del`);
    try {
      const res = await fetch(`/api/clients/${clientId}/sites/${s.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to remove site');
      clearDraft(s.id);
      await mutate();
      toast.success('Site removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove site');
    } finally {
      setBusy(null);
    }
  }

  async function addSite() {
    setAdding(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'New site' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to add site');
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add site');
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <ConfirmContainer />
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Sites &amp; Reporting</h2>
          <p className="text-xs text-gray-500">Each site is reported on separately. Add one per website/project.</p>
        </div>
        <button
          type="button"
          onClick={addSite}
          disabled={adding}
          className="text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {adding ? 'Adding…' : '+ Add site'}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500 py-4">Loading sites…</div>
      ) : sites.length === 0 ? (
        <div className="text-sm text-gray-500 py-4">
          No sites yet. Add one and click <span className="font-medium">Auto-detect</span> to pull in GA4, Vercel, and Search Console.
        </div>
      ) : (
        <div className="space-y-4">
          {sites.map(s => {
            const d = effective(s);
            const dirty = isDirty(s);
            return (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    value={d.label}
                    onChange={e => update(s, 'label', e.target.value)}
                    placeholder="Site label (e.g. Marketing site)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => detect(s)}
                    disabled={busy === `${s.id}-detect`}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 whitespace-nowrap"
                    title="Match this site's URL against your Vercel projects, GA4 properties, and Search Console"
                  >
                    {busy === `${s.id}-detect` ? 'Detecting…' : 'Auto-detect'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {FIELDS.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                      <input
                        value={d[f.key]}
                        onChange={e => update(s, f.key, e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => remove(s)}
                    disabled={busy === `${s.id}-del`}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {busy === `${s.id}-del` ? 'Removing…' : 'Remove'}
                  </button>
                  <button
                    type="button"
                    onClick={() => save(s)}
                    disabled={!dirty || busy === `${s.id}-save`}
                    className="text-xs font-medium px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy === `${s.id}-save` ? 'Saving…' : dirty ? 'Save' : 'Saved'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
