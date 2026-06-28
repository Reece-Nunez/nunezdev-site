'use client';

import { useRouter } from 'next/navigation';
import ProposalForm, { type ProposalFormData } from '@/components/proposals/ProposalForm';

export default function NewProposalPage() {
  const router = useRouter();

  const handleCreate = async (formData: ProposalFormData) => {
    const response = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create proposal');
    }
    router.push('/dashboard/proposals');
  };

  return (
    <ProposalForm
      heading="Create New Proposal"
      submitLabel="Create Proposal"
      submittingLabel="Creating..."
      onSubmit={handleCreate}
    />
  );
}
