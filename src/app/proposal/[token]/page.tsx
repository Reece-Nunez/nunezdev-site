'use client';

/* Hallmark · redesign · macrostructure: Long Document · genre: editorial
 * theme: brand (paper #fff8f1 · ink navy #0b2a4a · accent gold #ffc312 · display Lora)
 * scope: visual layer only — accept/decline/signature logic preserved
 */

import { useState, useRef, use } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import SignatureCanvas from 'react-signature-canvas';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface LineItem {
  description: string;
  quantity: number;
  rate_cents: number;
  amount_cents: number;
}

interface Proposal {
  id: string;
  proposal_number: string;
  title: string;
  description?: string;
  line_items: LineItem[];
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  amount_cents: number;
  status: string;
  valid_until?: string;
  require_signature: boolean;
  signed_at?: string;
  signer_name?: string;
  project_overview?: string;
  project_start_date?: string;
  estimated_delivery_date?: string;
  technology_stack?: string;
  terms_conditions?: string;
  payment_terms?: string;
  access_token: string;
  clients?: {
    id: string;
    name?: string;
    email?: string;
    company?: string;
  };
}

const formatCurrency = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

/** NunezDev letterhead mark — the real N logo plus the wordmark. */
function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/n-logo.svg" alt="NunezDev" width={38} height={38} className="h-9 w-9" priority />
      <span className="flex flex-col leading-none">
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold tracking-tight text-brand-navy">
          NunezDev
        </span>
        <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-400">
          Software Solutions
        </span>
      </span>
    </div>
  );
}

/** Serif section heading with a short gold tick, used for each document block. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-[family-name:var(--font-lora)] text-xl font-semibold text-brand-navy">
      <span aria-hidden className="h-4 w-1 rounded-full bg-brand-yellow" />
      {children}
    </h2>
  );
}

export default function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data, error, mutate } = useSWR<{ proposal: Proposal }>(`/api/public/proposal/${token}`, fetcher);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvas>(null);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-offwhite px-6">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-lora)] text-2xl font-semibold text-brand-navy mb-2">Proposal not found</h1>
          <p className="text-gray-500">This proposal link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-offwhite">
        <div className="text-gray-500">Loading proposal…</div>
      </div>
    );
  }

  const proposal = data.proposal;
  const techRaw = proposal.technology_stack?.trim() ?? '';
  const techSegments = techRaw ? techRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  // Chip only a genuine short comma list ("Next.js, Tailwind, Stripe"). A prose
  // stack (e.g. "Clickable prototype; plan covering platform, data model, …")
  // would shatter into garbage chips, so fall back to a plain paragraph.
  const techIsList = techSegments.length >= 2 && techSegments.every(s => s.length <= 28);

  const handleAccept = async () => {
    // Reveal the signature pad on first click when a signature is required.
    // (Before it's shown, <SignatureCanvas> isn't mounted and sigRef.current is
    // null — guard on showSignature rather than the ref's isEmpty(), which
    // returns undefined and reads as "already signed".)
    if (proposal.require_signature && !showSignature) {
      setShowSignature(true);
      return;
    }

    // Pad is visible but nothing was drawn.
    if (proposal.require_signature && sigRef.current?.isEmpty()) {
      setActionError('Please draw your signature in the box before accepting.');
      return;
    }

    setAccepting(true);
    setActionError(null);

    try {
      const signatureData = proposal.require_signature && sigRef.current
        ? sigRef.current.toDataURL('image/svg+xml')
        : null;

      const res = await fetch(`/api/proposals/${proposal.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: proposal.access_token,
          signer_name: signerName || proposal.clients?.name,
          signer_email: signerEmail || proposal.clients?.email,
          signature: signatureData
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to accept proposal');

      mutate();
      setShowSignature(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to accept proposal');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/proposals/${proposal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: proposal.access_token,
          reason: rejectReason
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to decline proposal');

      mutate();
      setShowRejectModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to decline proposal');
    } finally {
      setRejecting(false);
    }
  };

  const clearSignature = () => {
    sigRef.current?.clear();
  };

  const isExpired = proposal.status === 'expired';
  const isAccepted = proposal.status === 'accepted';
  const isRejected = proposal.status === 'rejected';
  const canAct = !isExpired && !isAccepted && !isRejected;

  const cardClass = 'rounded-2xl border border-black/5 bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(11,42,74,0.04),0_12px_32px_-16px_rgba(11,42,74,0.12)]';

  return (
    <div className="min-h-screen bg-brand-offwhite">
      {/* Letterhead band */}
      <div className="h-1.5 w-full bg-brand-yellow" />

      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-16 space-y-6">
        {/* Header / letterhead */}
        <header className={cardClass}>
          <div className="flex items-center justify-between gap-4">
            <Wordmark />
            <span className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.22em] text-gray-400">
              Proposal
            </span>
          </div>

          <hr className="my-7 border-black/5" />

          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-gray-400">
                {proposal.proposal_number}
              </div>
              <h1 className="mt-2 font-[family-name:var(--font-lora)] text-3xl sm:text-4xl font-semibold leading-[1.1] text-brand-navy [overflow-wrap:anywhere]">
                {proposal.title}
              </h1>
              {proposal.clients && (
                <p className="mt-3 text-sm text-gray-500">
                  Prepared for{' '}
                  <span className="font-medium text-gray-700">{proposal.clients.name}</span>
                  {proposal.clients.company && ` · ${proposal.clients.company}`}
                </p>
              )}
            </div>

            <div className="shrink-0 sm:text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Total investment</div>
              <div className="mt-1 inline-block border-b-2 border-brand-yellow pb-1 font-[family-name:var(--font-space-grotesk)] text-3xl sm:text-4xl font-bold tabular-nums text-brand-navy">
                {formatCurrency(proposal.amount_cents)}
              </div>
              {proposal.valid_until && !isAccepted && !isRejected && (
                <div className={`mt-2 text-xs ${isExpired ? 'text-red-600' : 'text-gray-400'}`}>
                  {isExpired ? 'Expired' : `Valid until ${formatDate(proposal.valid_until)}`}
                </div>
              )}
            </div>
          </div>

          {isAccepted && (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">Proposal accepted</span>
              {proposal.signer_name && <span className="text-sm text-emerald-700">by {proposal.signer_name}</span>}
            </div>
          )}

          {isRejected && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Proposal declined
            </div>
          )}

          {isExpired && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              This proposal has expired
            </div>
          )}

          {proposal.description && (
            <p className="mt-6 border-l-2 border-black/10 pl-4 text-[15px] leading-relaxed text-gray-600">
              {proposal.description}
            </p>
          )}
        </header>

        {/* Scope of Work */}
        <section className={cardClass}>
          <SectionHeading>Scope of Work</SectionHeading>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr className="border-b border-black/10 text-left font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 pl-4 text-right font-medium">Qty</th>
                  <th className="pb-3 pl-4 text-right font-medium">Rate</th>
                  <th className="pb-3 pl-4 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {proposal.line_items.map((item, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="py-4 pr-4 text-[15px] leading-relaxed text-gray-700">{item.description}</td>
                    <td className="py-4 pl-4 text-right text-sm tabular-nums text-gray-500">{item.quantity}</td>
                    <td className="py-4 pl-4 text-right font-[family-name:var(--font-geist-mono)] text-sm tabular-nums text-gray-500">{formatCurrency(item.rate_cents)}</td>
                    <td className="py-4 pl-4 text-right font-[family-name:var(--font-geist-mono)] text-sm font-medium tabular-nums text-brand-navy">{formatCurrency(item.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-black/10">
                  <td colSpan={3} className="py-3 text-right text-sm text-gray-500">Subtotal</td>
                  <td className="py-3 pl-4 text-right font-[family-name:var(--font-geist-mono)] text-sm tabular-nums text-gray-600">{formatCurrency(proposal.subtotal_cents)}</td>
                </tr>
                {proposal.discount_cents > 0 && (
                  <tr>
                    <td colSpan={3} className="py-1 text-right text-sm text-gray-500">Discount</td>
                    <td className="py-1 pl-4 text-right font-[family-name:var(--font-geist-mono)] text-sm tabular-nums text-red-600">-{formatCurrency(proposal.discount_cents)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} className="pt-3 text-right font-[family-name:var(--font-lora)] text-lg font-semibold text-brand-navy">Total</td>
                  <td className="pt-3 pl-4 text-right font-[family-name:var(--font-space-grotesk)] text-lg font-bold tabular-nums text-brand-navy">{formatCurrency(proposal.amount_cents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Project Details */}
        {(proposal.project_overview || proposal.project_start_date || techRaw) && (
          <section className={cardClass}>
            <SectionHeading>Project Details</SectionHeading>

            {proposal.project_overview && (
              <div className="mt-6">
                <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Overview</div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700">{proposal.project_overview}</p>
              </div>
            )}

            {(proposal.project_start_date || proposal.estimated_delivery_date) && (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {proposal.project_start_date && (
                  <div className="rounded-xl border border-black/5 bg-brand-offwhite/60 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Project start</div>
                    <div className="mt-1 font-medium text-brand-navy">{formatDate(proposal.project_start_date)}</div>
                  </div>
                )}
                {proposal.estimated_delivery_date && (
                  <div className="rounded-xl border border-black/5 bg-brand-offwhite/60 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Estimated delivery</div>
                    <div className="mt-1 font-medium text-brand-navy">{formatDate(proposal.estimated_delivery_date)}</div>
                  </div>
                )}
              </div>
            )}

            {techRaw && (
              <div className="mt-6">
                <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Technology stack</div>
                {techIsList ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {techSegments.map((tech, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-brand-navy/10 bg-brand-navy/[0.04] px-3 py-1 text-sm font-medium text-brand-navy"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[15px] leading-relaxed text-gray-700">{techRaw}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Terms & Conditions */}
        {proposal.terms_conditions && (
          <section className={cardClass}>
            <SectionHeading>Terms &amp; Conditions</SectionHeading>
            <p className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-600">{proposal.terms_conditions}</p>
          </section>
        )}

        {/* Sign to accept */}
        {showSignature && canAct && (
          <section className={cardClass}>
            <SectionHeading>Sign to accept</SectionHeading>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Your name</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus-visible:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder={proposal.clients?.name || 'Full name'}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Your email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus-visible:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder={proposal.clients?.email || 'Email'}
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-black/15 bg-brand-offwhite/50 p-2">
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{
                  className: 'w-full h-40 rounded-lg bg-white',
                  style: { width: '100%', height: '160px' }
                }}
              />
            </div>
            <button
              type="button"
              onClick={clearSignature}
              className="mt-2 text-xs text-gray-400 transition-colors hover:text-gray-600"
            >
              Clear signature
            </button>
          </section>
        )}

        {/* Decision panel — the one action this page drives */}
        {canAct && (
          <section className="rounded-2xl border border-brand-navy/10 bg-brand-navy p-6 sm:p-8 shadow-[0_20px_40px_-24px_rgba(11,42,74,0.5)]">
            {actionError && (
              <div className="mb-5 rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {actionError}
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-white/70">
                Ready to move forward? Accept below to get started.
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="text-sm text-white/60 transition-colors hover:text-white"
                >
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="rounded-lg bg-brand-yellow px-8 py-3.5 text-sm font-bold text-brand-black transition-colors hover:bg-[#e6ad00] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
                >
                  {accepting ? 'Processing…' : showSignature ? 'Submit & Accept' : 'Accept Proposal'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
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
            <h3 className="font-[family-name:var(--font-lora)] text-lg font-semibold text-brand-navy">Decline proposal</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to decline this proposal? You can optionally leave a reason.
            </p>
            <textarea
              className="mt-4 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
              rows={3}
              placeholder="Reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm text-gray-500 transition-colors hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {rejecting ? 'Declining…' : 'Decline Proposal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
