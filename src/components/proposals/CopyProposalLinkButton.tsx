'use client';

import { useState } from 'react';
import { proposalPublicUrl } from '@/lib/proposalSend';

/**
 * "Copy link" action for a proposal. Copies the public, no-login proposal URL
 * to the clipboard so the operator can paste it anywhere (Thumbtack chat, text,
 * DM) — no client email or phone required.
 *
 * When the proposal is still a draft, copying also marks it `sent` (channel
 * "link", which delivers nothing) so the client's eventual view registers in
 * the pipeline — the public route only upgrades sent -> viewed.
 */
export default function CopyProposalLinkButton({
  proposalId,
  token,
  status,
  onMarkedSent,
  className,
}: {
  proposalId: string;
  token: string;
  status: string;
  /** Called after a draft is flipped to sent, so the caller can refresh. */
  onMarkedSent?: () => void;
  className?: string;
}) {
  const [feedback, setFeedback] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopy = async () => {
    const url = proposalPublicUrl(window.location.origin, token);

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API needs a secure context; if it's unavailable, don't
      // silently mark the proposal sent — surface the failure instead.
      setFeedback('error');
      setTimeout(() => setFeedback('idle'), 2500);
      return;
    }

    setFeedback('copied');
    setTimeout(() => setFeedback('idle'), 2000);

    // Copying a draft link is an act of sharing — flip it to sent so a later
    // client view counts. Best-effort: a failed flip shouldn't undo the copy.
    if (status === 'draft') {
      try {
        const res = await fetch(`/api/proposals/${proposalId}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: 'link' }),
        });
        if (res.ok) onMarkedSent?.();
      } catch {
        // Link is already on the clipboard; leaving status as draft is safe.
      }
    }
  };

  const label =
    feedback === 'copied' ? 'Copied ✓' : feedback === 'error' ? 'Copy failed' : 'Copy link';

  return (
    <button
      onClick={handleCopy}
      className={
        className ??
        `text-xs ${feedback === 'error' ? 'text-red-600' : 'text-blue-600 hover:text-blue-800'}`
      }
      title="Copy the client-facing proposal link"
    >
      {label}
    </button>
  );
}
