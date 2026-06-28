'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

/**
 * One-tap relationship actions on a client: pitch a care plan, or ask for a
 * Google review. Both are human-initiated 1:1 messages (no auto-blast). The
 * review request prefers SMS and falls back to email server-side.
 */
export default function ClientOutreach({ clientId }: { clientId: string }) {
  const [sendingCare, setSendingCare] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);

  async function sendCarePlan() {
    setSendingCare(true);
    const toastId = toast.loading('Sending care-plan offer...');
    try {
      const res = await fetch(`/api/clients/${clientId}/care-plan-offer`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      toast.success('Care-plan offer emailed', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send', { id: toastId });
    } finally {
      setSendingCare(false);
    }
  }

  async function requestReview() {
    setSendingReview(true);
    const toastId = toast.loading('Sending review request...');
    try {
      const res = await fetch(`/api/clients/${clientId}/review-request`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      toast.success(`Review request sent by ${data.channel === 'sms' ? 'text' : 'email'}`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send', { id: toastId });
    } finally {
      setSendingReview(false);
    }
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold mb-1">Outreach</h2>
      <p className="text-sm text-gray-500 mb-3">
        One-tap messages to grow the relationship. Sent individually, not in bulk.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={sendCarePlan}
          disabled={sendingCare}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {sendingCare ? 'Sending...' : 'Send care-plan offer'}
        </button>
        <button
          onClick={requestReview}
          disabled={sendingReview}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {sendingReview ? 'Sending...' : 'Request Google review'}
        </button>
      </div>
    </section>
  );
}
