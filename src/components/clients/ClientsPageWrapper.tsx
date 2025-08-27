'use client';

import { useState } from 'react';
import useSWR from 'swr';
import ClientsTable from './ClientsTable';
import type { ClientOverview } from '@/types/clients';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ClientsPageWrapper() {
  const { data, mutate } = useSWR<ClientOverview[]>('/api/clients', fetcher);
  
  const handleClientDeleted = () => {
    // Refresh the clients list after deletion
    mutate();
  };

  if (!data) {
    return (
      <div className="p-6 my-36">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return <ClientsTable rows={data} onClientDeleted={handleClientDeleted} />;
}