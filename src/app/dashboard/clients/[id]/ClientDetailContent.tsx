'use client';

import Link from 'next/link';
import { useState } from 'react';
import ClientForm from '@/components/client-detail/ClientForm';
import ClientNotes from '@/components/client-detail/ClientNotes';
import ClientTasks from '@/components/client-detail/ClientTasks';
import { ClientInvoices } from '@/components/client-detail/Related';
import AddPayment from '@/components/client-detail/AddPayment';

export default function ClientDetailContent({ clientId }: { clientId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/clients" className="text-sm text-blue-600 hover:underline">
          ← Back to clients
        </Link>
      </div>

      <ClientForm clientId={clientId} />

      {/* Invoices & Payments */}
      <section className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Invoices & Payments</h2>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/invoices/new?clientId=${clientId}`}
              className="rounded-lg px-4 py-2 text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: '#ffc312' }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#e6ad0f'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#ffc312'}
            >
              + New Invoice
            </Link>
            <AddPayment clientId={clientId} onCreated={bump} />
          </div>
        </div>
        <div>
          <ClientInvoices key={`invoices-${refreshKey}`} clientId={clientId} />
        </div>
      </section>

      {/* Notes */}
      <ClientNotes clientId={clientId} />

      {/* Tasks */}
      <ClientTasks clientId={clientId} />
    </div>
  );
}