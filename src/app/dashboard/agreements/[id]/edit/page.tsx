'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import AgreementForm, { type AgreementFormData, emptyAgreementForm } from '@/components/agreements/AgreementForm';
import type { Agreement } from '@/types/agreements';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function EditAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error } = useSWR<{ agreement: Agreement }>(`/api/agreements/${id}`, fetcher);

  const handleSubmit = async (formData: AgreementFormData) => {
    const res = await fetch(`/api/agreements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formData.title,
        summary: formData.summary,
        sections: formData.sections,
        valid_until: formData.valid_until || null,
        require_signature: formData.require_signature,
        internal_notes: formData.internal_notes,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update agreement');
    router.push(`/dashboard/agreements/${id}`);
  };

  if (error) {
    return <div className="p-6 text-red-600">Failed to load agreement.</div>;
  }
  if (!data) {
    return <div className="p-6 text-gray-500">Loading…</div>;
  }

  const a = data.agreement;
  const initialData: AgreementFormData = {
    ...emptyAgreementForm(),
    client_id: a.client_id,
    title: a.title,
    summary: a.summary ?? '',
    sections: a.sections?.length ? a.sections : emptyAgreementForm().sections,
    valid_until: a.valid_until ? a.valid_until.slice(0, 10) : '',
    require_signature: a.require_signature,
    internal_notes: a.internal_notes ?? '',
  };

  return (
    <AgreementForm
      heading={`Edit ${a.agreement_number}`}
      submitLabel="Save Changes"
      submittingLabel="Saving…"
      initialData={initialData}
      onSubmit={handleSubmit}
    />
  );
}
