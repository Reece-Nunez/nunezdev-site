'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import ProposalForm, {
  type ProposalFormData,
  type ProposalLineItem,
  emptyProposalForm,
} from '@/components/proposals/ProposalForm';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** A date/timestamp column -> the YYYY-MM-DD an <input type="date"> expects. */
function toDateInput(value: unknown): string {
  if (!value || typeof value !== 'string') return '';
  return value.slice(0, 10);
}

/** technology_stack is a text[] in the DB but a comma string in the form. */
function stackToString(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string') return value;
  return '';
}

function toFormData(p: Record<string, unknown>): ProposalFormData {
  const base = emptyProposalForm();
  const lineItems = Array.isArray(p.line_items) ? (p.line_items as ProposalLineItem[]) : [];
  return {
    ...base,
    client_id: (p.client_id as string) ?? '',
    title: (p.title as string) ?? '',
    description: (p.description as string) ?? '',
    line_items: lineItems.length ? lineItems : base.line_items,
    valid_until: toDateInput(p.valid_until),
    project_overview: (p.project_overview as string) ?? '',
    project_start_date: toDateInput(p.project_start_date),
    estimated_delivery_date: toDateInput(p.estimated_delivery_date),
    technology_stack: stackToString(p.technology_stack),
    terms_conditions: (p.terms_conditions as string) ?? '',
    payment_terms: (p.payment_terms as string) ?? base.payment_terms,
    require_signature: p.require_signature !== false,
    discount_type: (p.discount_type as 'percentage' | 'fixed') ?? 'percentage',
    discount_value: (p.discount_value as number) ?? 0,
  };
}

export default function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, isLoading } = useSWR(`/api/proposals/${id}`, fetcher);

  const handleSave = async (formData: ProposalFormData) => {
    const response = await fetch(`/api/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update proposal');
    }
    router.push('/dashboard/proposals');
  };

  if (isLoading) {
    return <div className="px-3 py-4 sm:p-6 max-w-4xl mx-auto text-gray-500">Loading proposal…</div>;
  }

  if (error || !data?.proposal) {
    return (
      <div className="px-3 py-4 sm:p-6 max-w-4xl mx-auto">
        <Link href="/dashboard/proposals" className="text-emerald-600 hover:underline text-sm mb-4 inline-block">
          ← Back to Proposals
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {data?.error || 'Proposal not found.'}
        </div>
      </div>
    );
  }

  return (
    <ProposalForm
      heading="Edit Proposal"
      submitLabel="Save Changes"
      submittingLabel="Saving..."
      initialData={toFormData(data.proposal)}
      onSubmit={handleSave}
    />
  );
}
