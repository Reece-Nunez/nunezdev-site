'use client';

import { useRouter } from 'next/navigation';
import AgreementForm, { type AgreementFormData } from '@/components/agreements/AgreementForm';

export default function NewAgreementPage() {
  const router = useRouter();

  const handleSubmit = async (data: AgreementFormData) => {
    const res = await fetch('/api/agreements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: data.client_id,
        title: data.title,
        summary: data.summary,
        sections: data.sections,
        valid_until: data.valid_until || null,
        require_signature: data.require_signature,
        internal_notes: data.internal_notes,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create agreement');
    router.push(`/dashboard/agreements/${json.agreement.id}`);
  };

  return (
    <AgreementForm
      heading="New Agreement"
      submitLabel="Create Agreement"
      submittingLabel="Creating…"
      onSubmit={handleSubmit}
    />
  );
}
