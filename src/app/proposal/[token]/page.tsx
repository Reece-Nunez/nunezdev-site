'use client';

import { useState, useRef, use } from 'react';
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Proposal Not Found</h1>
          <p className="text-gray-600">This proposal link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading proposal...</div>
      </div>
    );
  }

  const proposal = data.proposal;

  const handleAccept = async () => {
    if (proposal.require_signature && !sigRef.current?.isEmpty()) {
      // Has signature, proceed
    } else if (proposal.require_signature) {
      setShowSignature(true);
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Proposal {proposal.proposal_number}</div>
              <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
              {proposal.clients && (
                <div className="text-gray-600 mt-1">
                  Prepared for: <span className="font-medium">{proposal.clients.name}</span>
                  {proposal.clients.company && ` (${proposal.clients.company})`}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-emerald-600">{formatCurrency(proposal.amount_cents)}</div>
              {proposal.valid_until && !isAccepted && !isRejected && (
                <div className={`text-sm mt-1 ${isExpired ? 'text-red-600' : 'text-gray-500'}`}>
                  {isExpired ? 'Expired' : `Valid until ${formatDate(proposal.valid_until)}`}
                </div>
              )}
            </div>
          </div>

          {/* Status Banner */}
          {isAccepted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Proposal Accepted</span>
                {proposal.signer_name && <span className="text-sm">by {proposal.signer_name}</span>}
              </div>
            </div>
          )}

          {isRejected && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-red-700 font-medium">Proposal Declined</div>
            </div>
          )}

          {isExpired && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="text-amber-700 font-medium">This proposal has expired</div>
            </div>
          )}

          {proposal.description && (
            <p className="text-gray-600 mt-4">{proposal.description}</p>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Scope of Work</h2>
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-2">Description</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Rate</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {proposal.line_items.map((item, idx) => (
                <tr key={idx} className="border-b last:border-b-0">
                  <td className="py-3">{item.description}</td>
                  <td className="py-3 text-right">{item.quantity}</td>
                  <td className="py-3 text-right">{formatCurrency(item.rate_cents)}</td>
                  <td className="py-3 text-right font-medium">{formatCurrency(item.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={3} className="py-2 text-right text-gray-600">Subtotal</td>
                <td className="py-2 text-right">{formatCurrency(proposal.subtotal_cents)}</td>
              </tr>
              {proposal.discount_cents > 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-right text-gray-600">Discount</td>
                  <td className="py-2 text-right text-red-600">-{formatCurrency(proposal.discount_cents)}</td>
                </tr>
              )}
              <tr className="font-bold text-lg">
                <td colSpan={3} className="py-2 text-right">Total</td>
                <td className="py-2 text-right text-emerald-600">{formatCurrency(proposal.amount_cents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Project Details */}
        {(proposal.project_overview || proposal.project_start_date || proposal.technology_stack) && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="font-semibold text-lg mb-4">Project Details</h2>

            {proposal.project_overview && (
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-1">Overview</div>
                <p className="text-gray-700 whitespace-pre-wrap">{proposal.project_overview}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {proposal.project_start_date && (
                <div>
                  <div className="text-sm text-gray-500">Project Start</div>
                  <div className="font-medium">{formatDate(proposal.project_start_date)}</div>
                </div>
              )}
              {proposal.estimated_delivery_date && (
                <div>
                  <div className="text-sm text-gray-500">Estimated Delivery</div>
                  <div className="font-medium">{formatDate(proposal.estimated_delivery_date)}</div>
                </div>
              )}
            </div>

            {proposal.technology_stack && (
              <div className="mt-4">
                <div className="text-sm text-gray-500 mb-1">Technology Stack</div>
                <div className="font-medium">{proposal.technology_stack}</div>
              </div>
            )}
          </div>
        )}

        {/* Terms */}
        {proposal.terms_conditions && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="font-semibold text-lg mb-4">Terms & Conditions</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{proposal.terms_conditions}</p>
          </div>
        )}

        {/* Signature Section */}
        {showSignature && canAct && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="font-semibold text-lg mb-4">Sign to Accept</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Your Name</label>
                <input
                  type="text"
                  className="w-full rounded-lg border px-3 py-2"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder={proposal.clients?.name || 'Full Name'}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Your Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border px-3 py-2"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder={proposal.clients?.email || 'Email'}
                />
              </div>
            </div>

            <div className="border rounded-lg p-2 bg-gray-50">
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{
                  className: 'w-full h-40 bg-white rounded',
                  style: { width: '100%', height: '160px' }
                }}
              />
            </div>
            <button
              type="button"
              onClick={clearSignature}
              className="text-sm text-gray-500 hover:text-gray-700 mt-2"
            >
              Clear signature
            </button>
          </div>
        )}

        {/* Actions */}
        {canAct && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            {actionError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowRejectModal(true)}
                className="text-gray-600 hover:text-gray-800"
              >
                Decline Proposal
              </button>

              <button
                onClick={handleAccept}
                disabled={accepting}
                className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
              >
                {accepting ? 'Processing...' : showSignature ? 'Submit & Accept' : 'Accept Proposal'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-8">
          Powered by <span className="font-medium">NunezDev</span>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Decline Proposal</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to decline this proposal? You can optionally provide a reason.
            </p>
            <textarea
              className="w-full rounded-lg border px-3 py-2 mb-4"
              rows={3}
              placeholder="Reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? 'Declining...' : 'Decline Proposal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
