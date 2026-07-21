'use client';

import { use, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import SignatureCanvas from 'react-signature-canvas';
import { useToast } from '@/components/ui/Toast';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { parseAgreementBody } from '@/lib/agreements/renderBody';
import type { Agreement, AgreementStatus } from '@/types/agreements';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusTone: Record<AgreementStatus, BadgeTone> = {
  draft: 'neutral', sent: 'info', viewed: 'purple', signed: 'warning',
  countersigned: 'success', declined: 'danger', expired: 'muted',
};
const statusLabels: Record<AgreementStatus, string> = {
  draft: 'Draft', sent: 'Sent', viewed: 'Viewed', signed: 'Client signed',
  countersigned: 'Fully executed', declined: 'Declined', expired: 'Expired',
};

function SectionBody({ body }: { body: string }) {
  const blocks = parseAgreementBody(body);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) =>
        block.type === 'bullets' ? (
          <ul key={i} className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed text-gray-700">
            {block.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700">{block.text}</p>
        ),
      )}
    </div>
  );
}

export default function AgreementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, mutate } = useSWR<{ agreement: Agreement }>(`/api/agreements/${id}`, fetcher);
  const { showToast, ToastContainer } = useToast();
  const sigRef = useRef<SignatureCanvas>(null);
  const [showCountersign, setShowCountersign] = useState(false);
  const [signerName, setSignerName] = useState('Reece Nunez');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (error) return <div className="p-6 text-red-600">Failed to load agreement.</div>;
  if (!data) return <div className="p-6 text-gray-500">Loading…</div>;

  const a = data.agreement;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/agreement/${a.access_token}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy link', 'error');
    }
  };

  const handleCountersign = async () => {
    if (sigRef.current?.isEmpty()) {
      showToast('Please draw your signature first.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const signature = sigRef.current!.toDataURL('image/svg+xml');
      const res = await fetch(`/api/agreements/${id}/countersign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_name: signerName, signature }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to counter-sign');
      showToast(json.fully_executed ? 'Agreement fully executed' : 'Counter-signed — awaiting client signature', 'success');
      setShowCountersign(false);
      mutate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to counter-sign', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const canCountersign = !a.dev_signed_at && !['declined', 'expired'].includes(a.status);
  const isEditable = ['draft', 'sent', 'viewed'].includes(a.status);

  return (
    <div className="px-3 py-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <ToastContainer />

      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard/agreements" className="text-emerald-600 hover:underline text-sm">← Back to Agreements</Link>
        <Badge tone={statusTone[a.status] ?? 'neutral'}>{statusLabels[a.status]}</Badge>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={copyLink} className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          {copied ? 'Copied ✓' : 'Copy client link'}
        </button>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Open client view ↗
        </a>
        {isEditable && (
          <Link href={`/dashboard/agreements/${a.id}/edit`} className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Edit</Link>
        )}
        {canCountersign && !showCountersign && (
          <button onClick={() => setShowCountersign(true)} className="rounded-lg bg-brand-yellow px-3 py-1.5 text-sm font-semibold text-brand-black hover:bg-brand-yellow/90">
            Counter-sign
          </button>
        )}
      </div>

      {/* Document */}
      <div className="rounded-2xl border bg-white p-5 sm:p-8 space-y-6">
        <div>
          <div className="font-mono text-xs tracking-widest text-gray-400">{a.agreement_number}</div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{a.title}</h1>
          <p className="mt-2 text-sm text-gray-500">
            Prepared for <span className="font-medium text-gray-700">{a.clients?.name}</span>
            {a.clients?.company ? ` · ${a.clients.company}` : ''}
          </p>
          {a.summary && <p className="mt-4 border-l-2 border-gray-200 pl-4 text-[15px] leading-relaxed text-gray-600">{a.summary}</p>}
        </div>

        {a.sections?.map((s, i) => (
          <div key={i}>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <span className="h-4 w-1 rounded-full bg-brand-yellow" />
              {s.heading}
            </h2>
            <SectionBody body={s.body} />
          </div>
        ))}

        {/* Signature status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-6">
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Owner (client)</div>
            {a.client_signed_at ? (
              <>
                <div className="mt-1 font-medium text-gray-800">{a.client_signer_name}</div>
                <div className="text-xs text-gray-500">Signed {new Date(a.client_signed_at).toLocaleString()}</div>
                {a.client_signature_svg && <img src={a.client_signature_svg} alt="Client signature" className="mt-2 h-12 object-contain" />}
              </>
            ) : (
              <div className="mt-1 text-sm text-gray-400">Not yet signed</div>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Developer (you)</div>
            {a.dev_signed_at ? (
              <>
                <div className="mt-1 font-medium text-gray-800">{a.dev_signer_name}</div>
                <div className="text-xs text-gray-500">Counter-signed {new Date(a.dev_signed_at).toLocaleString()}</div>
                {a.dev_signature_svg && <img src={a.dev_signature_svg} alt="Developer signature" className="mt-2 h-12 object-contain" />}
              </>
            ) : (
              <div className="mt-1 text-sm text-gray-400">Not yet counter-signed</div>
            )}
          </div>
        </div>
      </div>

      {/* Counter-sign pad */}
      {showCountersign && (
        <div className="rounded-2xl border bg-white p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Counter-sign this agreement</h3>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Your name</label>
            <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="rounded-xl border border-dashed border-black/15 bg-gray-50/50 p-2">
            <SignatureCanvas ref={sigRef} canvasProps={{ className: 'w-full h-40 rounded-lg bg-white', style: { width: '100%', height: '160px' } }} />
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => sigRef.current?.clear()} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
            <div className="flex gap-2">
              <button onClick={() => setShowCountersign(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleCountersign} disabled={submitting} className="rounded-lg bg-brand-yellow px-4 py-1.5 text-sm font-semibold text-brand-black hover:bg-brand-yellow/90 disabled:opacity-60">
                {submitting ? 'Signing…' : 'Submit counter-signature'}
              </button>
            </div>
          </div>
        </div>
      )}

      {a.internal_notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Internal notes</div>
          <p className="mt-1 whitespace-pre-wrap">{a.internal_notes}</p>
        </div>
      )}
    </div>
  );
}
