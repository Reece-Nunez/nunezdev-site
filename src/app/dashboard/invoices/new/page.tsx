'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import InvoiceBuilder from '@/components/invoices/InvoiceBuilder';
import type { CreateInvoiceData } from '@/types/invoice';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function NewInvoicePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  
  // Fetch clients for the dropdown
  const { data: clientsData } = useSWR('/api/clients', fetcher);
  const clients = clientsData?.clients || [];

  const handleCreateInvoice = async (invoiceData: CreateInvoiceData) => {
    setCreating(true);
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invoice');
      }

      const result = await response.json();
      
      // Redirect to the created invoice
      router.push(`/invoices/${result.invoice.id}`);
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert(error instanceof Error ? error.message : 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/invoices');
  };

  return (
    <div className="px-3 py-4 sm:p-6 space-y-4 max-w-5xl mx-auto min-w-0">
      <div className="mb-6">
        <button
          onClick={handleCancel}
          className="text-blue-600 hover:underline text-sm mb-2"
        >
          ← Back to Invoices
        </button>
        <h1 className="text-3xl font-bold">Create New Invoice</h1>
        <p className="text-gray-600 mt-1">Build a professional invoice with line items and custom terms</p>
      </div>

      <InvoiceBuilder
        clients={clients}
        onSave={handleCreateInvoice}
        onCancel={handleCancel}
        loading={creating}
      />
    </div>
  );
}