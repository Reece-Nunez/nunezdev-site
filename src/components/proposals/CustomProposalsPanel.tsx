'use client';

import Link from 'next/link';
import { CUSTOM_PROPOSALS, customProposalPath } from '@/lib/customProposals';

/**
 * Lists the hand-built, static proposal pages (src/app/proposal/<slug>) that
 * don't live in the proposals table. Gives every bespoke proposal URL one place
 * to be seen and copied. Registry lives in @/lib/customProposals.
 */
export default function CustomProposalsPanel({
  showToast,
}: {
  showToast: (message: string, type?: 'success' | 'error') => void;
}) {
  if (CUSTOM_PROPOSALS.length === 0) return null;

  const copyLink = async (slug: string) => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${customProposalPath(slug)}`
        : customProposalPath(slug);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Proposal link copied', 'success');
    } catch {
      showToast('Could not copy link', 'error');
    }
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Custom proposal pages</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Hand-built proposals hosted at their own URL. Not in the table above — tracked here so no link gets lost.
        </p>
      </div>
      <ul className="divide-y divide-gray-100">
        {CUSTOM_PROPOSALS.map((p) => (
          <li key={p.slug} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {p.client} <span className="text-gray-400">·</span>{' '}
                <span className="text-gray-600">{p.company}</span>
              </div>
              <div className="text-xs text-gray-500 truncate">
                {customProposalPath(p.slug)} · {p.amount} · prepared {new Date(p.preparedOn).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                href={customProposalPath(p.slug)}
                target="_blank"
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Open
              </Link>
              <button
                onClick={() => copyLink(p.slug)}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                Copy link
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
