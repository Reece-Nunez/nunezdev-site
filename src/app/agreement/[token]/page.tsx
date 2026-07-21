'use client';

/* Brand-styled public agreement page (paper #fff8f1 · ink navy · gold accent).
 * Bilateral signing: the Owner signs or declines here; the Developer
 * counter-signs from the dashboard. Mirrors the proposal public page. */

import { useState, useRef, use } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import SignatureCanvas from 'react-signature-canvas';
import { parseAgreementBody } from '@/lib/agreements/renderBody';
import type { Agreement } from '@/types/agreements';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/n-logo.svg" alt="NunezDev" width={38} height={38} className="h-9 w-9" priority />
      <span className="flex flex-col leading-none">
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold tracking-tight text-brand-navy">NunezDev</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-400">Software Solutions</span>
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-[family-name:var(--font-lora)] text-xl font-semibold text-brand-navy">
      <span aria-hidden className="h-4 w-1 rounded-full bg-brand-yellow" />
      {children}
    </h2>
  );
}

function SectionBody({ body }: { body: string }) {
  const blocks = parseAgreementBody(body);
  return (
    <div className="mt-4 space-y-3">
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

export default function PublicAgreementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data, error, mutate } = useSWR<{ agreement: Agreement }>(`/api/public/agreement/${token}`, fetcher);
  const [signing, setSigning] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvas>(null);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-offwhite px-6">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-lora)] text-2xl font-semibold text-brand-navy mb-2">Agreement not found</h1>
          <p className="text-gray-500">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-brand-offwhite"><div className="text-gray-500">Loading agreement…</div></div>;
  }

  const a = data.agreement;

  const handleSign = async () => {
    if (a.require_signature && !showSignature) {
      setShowSignature(true);
      return;
    }
    if (a.require_signature && sigRef.current?.isEmpty()) {
      setActionError('Please draw your signature in the box before signing.');
      return;
    }
    setSigning(true);
    setActionError(null);
    try {
      const signature = a.require_signature && sigRef.current ? sigRef.current.toDataURL('image/svg+xml') : null;
      const res = await fetch(`/api/agreements/${a.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: a.access_token,
          signer_name: signerName || a.clients?.name,
          signer_email: signerEmail || a.clients?.email,
          signature,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to sign agreement');
      mutate();
      setShowSignature(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to sign agreement');
    } finally {
      setSigning(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/agreements/${a.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: a.access_token, reason: rejectReason }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to decline agreement');
      mutate();
      setShowRejectModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to decline agreement');
    } finally {
      setRejecting(false);
    }
  };

  const isExpired = a.status === 'expired';
  const isDeclined = a.status === 'declined';
  const isSigned = Boolean(a.client_signed_at);
  const isExecuted = a.status === 'countersigned';
  const canAct = !isExpired && !isDeclined && !isSigned;

  const cardClass = 'rounded-2xl border border-black/5 bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(11,42,74,0.04),0_12px_32px_-16px_rgba(11,42,74,0.12)]';

  return (
    <div className="min-h-screen bg-brand-offwhite">
      <div className="h-1.5 w-full bg-brand-yellow" />

      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-16 space-y-6">
        <header className={cardClass}>
          <div className="flex items-center justify-between gap-4">
            <Wordmark />
            <span className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.22em] text-gray-400">Agreement</span>
          </div>

          <hr className="my-7 border-black/5" />

          <div className="font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-gray-400">{a.agreement_number}</div>
          <h1 className="mt-2 font-[family-name:var(--font-lora)] text-3xl sm:text-4xl font-semibold leading-[1.1] text-brand-navy [overflow-wrap:anywhere]">{a.title}</h1>
          {a.clients && (
            <p className="mt-3 text-sm text-gray-500">
              Prepared for <span className="font-medium text-gray-700">{a.clients.name}</span>
              {a.clients.company && ` · ${a.clients.company}`}
            </p>
          )}
          {a.valid_until && canAct && (
            <div className={`mt-2 text-xs ${isExpired ? 'text-red-600' : 'text-gray-400'}`}>
              {isExpired ? 'Expired' : `Valid until ${formatDate(a.valid_until)}`}
            </div>
          )}

          {isExecuted && (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span className="text-sm font-medium">Fully executed by both parties</span>
            </div>
          )}
          {isSigned && !isExecuted && (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span className="text-sm font-medium">Signed{a.client_signer_name ? ` by ${a.client_signer_name}` : ''}. Awaiting NunezDev counter-signature.</span>
            </div>
          )}
          {isDeclined && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Agreement declined</div>}
          {isExpired && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">This agreement has expired</div>}

          {a.summary && <p className="mt-6 border-l-2 border-black/10 pl-4 text-[15px] leading-relaxed text-gray-600">{a.summary}</p>}
        </header>

        {a.sections?.map((s, i) => (
          <section key={i} className={cardClass}>
            <SectionHeading>{s.heading}</SectionHeading>
            <SectionBody body={s.body} />
          </section>
        ))}

        {/* Signature block — both parties */}
        <section className={cardClass}>
          <SectionHeading>Signatures</SectionHeading>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-black/5 bg-brand-offwhite/50 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Owner</div>
              {a.client_signed_at ? (
                <>
                  <div className="mt-1 font-medium text-brand-navy">{a.client_signer_name}</div>
                  <div className="text-xs text-gray-500">Signed {formatDate(a.client_signed_at)}</div>
                  {a.client_signature_svg && <img src={a.client_signature_svg} alt="Owner signature" className="mt-2 h-12 object-contain" />}
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-400">Awaiting signature</div>
              )}
            </div>
            <div className="rounded-xl border border-black/5 bg-brand-offwhite/50 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Developer · NunezDev</div>
              {a.dev_signed_at ? (
                <>
                  <div className="mt-1 font-medium text-brand-navy">{a.dev_signer_name}</div>
                  <div className="text-xs text-gray-500">Counter-signed {formatDate(a.dev_signed_at)}</div>
                  {a.dev_signature_svg && <img src={a.dev_signature_svg} alt="Developer signature" className="mt-2 h-12 object-contain" />}
                </>
              ) : (
                <div className="mt-1 text-sm text-gray-400">Awaiting counter-signature</div>
              )}
            </div>
          </div>
        </section>

        {/* Sign pad */}
        {showSignature && canAct && (
          <section className={cardClass}>
            <SectionHeading>Sign to accept</SectionHeading>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Your name</label>
                <input type="text" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus-visible:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder={a.clients?.name || 'Full name'} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Your email</label>
                <input type="email" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus-visible:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder={a.clients?.email || 'Email'} />
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-black/15 bg-brand-offwhite/50 p-2">
              <SignatureCanvas ref={sigRef} canvasProps={{ className: 'w-full h-40 rounded-lg bg-white', style: { width: '100%', height: '160px' } }} />
            </div>
            <button type="button" onClick={() => sigRef.current?.clear()} className="mt-2 text-xs text-gray-400 transition-colors hover:text-gray-600">Clear signature</button>
          </section>
        )}

        {/* Decision panel */}
        {canAct && (
          <section className="rounded-2xl border border-brand-navy/10 bg-brand-navy p-6 sm:p-8 shadow-[0_20px_40px_-24px_rgba(11,42,74,0.5)]">
            {actionError && <div className="mb-5 rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{actionError}</div>}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-white/70">Ready to move forward? Sign below to accept these terms.</div>
              <div className="flex items-center gap-4">
                <button onClick={() => setShowRejectModal(true)} className="text-sm text-white/60 transition-colors hover:text-white">Decline</button>
                <button onClick={handleSign} disabled={signing} className="rounded-lg bg-brand-yellow px-8 py-3.5 text-sm font-bold text-brand-black transition-colors hover:bg-[#e6ad00] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow">
                  {signing ? 'Processing…' : showSignature ? 'Submit & Sign' : 'Sign Agreement'}
                </button>
              </div>
            </div>
          </section>
        )}

        <footer className="pt-4 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <Image src="/n-logo.svg" alt="NunezDev" width={20} height={20} className="h-5 w-5" />
            <span>Prepared by <span className="font-medium text-gray-500">NunezDev</span></span>
          </div>
        </footer>
      </main>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-[family-name:var(--font-lora)] text-lg font-semibold text-brand-navy">Decline agreement</h3>
            <p className="mt-2 text-sm text-gray-500">Are you sure you want to decline? You can optionally leave a reason.</p>
            <textarea className="mt-4 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20" rows={3} placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm text-gray-500 transition-colors hover:text-gray-800">Cancel</button>
              <button onClick={handleReject} disabled={rejecting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60">
                {rejecting ? 'Declining…' : 'Decline Agreement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
