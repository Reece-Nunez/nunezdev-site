'use client';

import { useState } from 'react';
import { agreementPublicUrl } from '@/lib/agreements/share';

/**
 * "Copy link" for an agreement. Copies the public, no-login URL so the operator
 * can paste it anywhere. Copying a draft also marks it `sent` (channel "link",
 * which delivers nothing) so the client's eventual view registers in the
 * pipeline — the public route only upgrades sent -> viewed.
 */
export default function CopyAgreementLinkButton({
  agreementId,
  token,
  status,
  onMarkedSent,
  className,
}: {
  agreementId: string;
  token: string;
  status: string;
  onMarkedSent?: () => void;
  className?: string;
}) {
  const [feedback, setFeedback] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopy = async () => {
    const url = agreementPublicUrl(window.location.origin, token);

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setFeedback('error');
      setTimeout(() => setFeedback('idle'), 2500);
      return;
    }

    setFeedback('copied');
    setTimeout(() => setFeedback('idle'), 2000);

    if (status === 'draft') {
      try {
        const res = await fetch(`/api/agreements/${agreementId}/send`, {
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

  const label = feedback === 'copied' ? 'Copied ✓' : feedback === 'error' ? 'Copy failed' : 'Copy link';

  return (
    <button
      onClick={handleCopy}
      className={
        className ?? `text-xs ${feedback === 'error' ? 'text-red-600' : 'text-blue-600 hover:text-blue-800'}`
      }
      title="Copy the client-facing agreement link"
    >
      {label}
    </button>
  );
}
