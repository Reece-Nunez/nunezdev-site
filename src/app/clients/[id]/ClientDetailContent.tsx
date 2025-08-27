'use client';

import Link from 'next/link';
import { useState } from 'react';
import ClientForm from '@/components/client-detail/ClientForm';
import ClientNotes from '@/components/client-detail/ClientNotes';
import ClientTasks from '@/components/client-detail/ClientTasks';
import { ClientDeals, ClientInvoices } from '@/components/client-detail/Related';
import AddDeal from '@/components/client-detail/AddDeal';
import AddInvoice from '@/components/client-detail/AddInvoice';
import AddPayment from '@/components/client-detail/AddPayment';

export default function ClientDetailContent({ clientId }: { clientId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="p-6 my-36 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/clients" className="text-sm text-blue-600 hover:underline">
          ← Back to clients
        </Link>
      </div>

      <ClientForm clientId={clientId} />

      {/* Deals */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">Deals</h2>
        <AddDeal clientId={clientId} onCreated={bump} />
        <div className="mt-4">
          <ClientDeals key={`deals-${refreshKey}`} clientId={clientId} />
        </div>
      </section>

      {/* Invoices & Payments */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">Invoices & Payments</h2>
        <div className="flex gap-2 mb-4">
          <AddInvoice clientId={clientId} onCreated={bump} />
          <AddPayment clientId={clientId} onCreated={bump} />
        </div>
        <div className="mt-4">
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