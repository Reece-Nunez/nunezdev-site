'use client';

import useSWR, { useSWRConfig } from 'swr';
import Link from 'next/link';
import { useState } from 'react';
import { stageToProgress, currency } from '@/lib/progress';
import { useToast } from '@/components/ui/Toast';

interface Deal {
  id: string;
  title: string;
  stage: string;
  value_cents: number;
  probability: number;
  expected_close_date?: string | null;
  created_at: string;
  client?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  source?: string;
  hubspot_deal_id?: string;
}

interface DealsResponse {
  deals: Deal[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDate(dateString?: string | null) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString();
}

function getStageColor(stage: string) {
  const colors = {
    'Contacted': 'bg-blue-100 text-blue-800',
    'Negotiation': 'bg-yellow-100 text-yellow-800',
    'Contract Sent': 'bg-orange-100 text-orange-800',
    'Contract Signed': 'bg-purple-100 text-purple-800',
    'Won': 'bg-green-100 text-green-800',
    'Lost': 'bg-red-100 text-red-800',
    'Abandoned': 'bg-gray-100 text-gray-800',
  };
  return colors[stage as keyof typeof colors] || 'bg-gray-100 text-gray-800';
}

export default function DealsPage() {
  const { data, error, isLoading } = useSWR<DealsResponse>('/api/deals', fetcher);
  const { mutate } = useSWRConfig();
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingDeal, setDeletingDeal] = useState<string | null>(null);
  const { showToast, ToastContainer } = useToast();

  if (isLoading) return <div className="p-6">Loading deals…</div>;
  if (error || !data) return <div className="p-6 text-red-600">Failed to load deals</div>;

  const deals = data.deals || [];
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value_cents || 0), 0);
  const openDeals = deals.filter(deal => !['Won', 'Lost', 'Abandoned'].includes(deal.stage));
  const wonDeals = deals.filter(deal => deal.stage === 'Won');

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm('Are you sure you want to delete this deal? This action cannot be undone.')) {
      return;
    }

    setDeletingDeal(dealId);
    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete deal');
      }

      mutate('/api/deals');
      showToast('Deal deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting deal:', error);
      showToast(error instanceof Error ? error.message : 'Failed to delete deal', 'error');
    } finally {
      setDeletingDeal(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDeals.size === 0) {
      showToast('No deals selected', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedDeals.size} deal(s)? This action cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      const deletePromises = Array.from(selectedDeals).map(dealId =>
        fetch(`/api/deals/${dealId}`, { method: 'DELETE' })
      );

      const results = await Promise.allSettled(deletePromises);
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      setSelectedDeals(new Set());
      mutate('/api/deals');
      
      if (successful > 0) {
        showToast(`${successful} deal(s) deleted successfully`, 'success');
      }
      if (failed > 0) {
        showToast(`${failed} deal(s) failed to delete`, 'error');
      }
    } catch (error) {
      console.error('Error deleting deals:', error);
      showToast('Failed to delete deals', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleDealSelection = (dealId: string) => {
    setSelectedDeals(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(dealId)) {
        newSelection.delete(dealId);
      } else {
        newSelection.add(dealId);
      }
      return newSelection;
    });
  };

  const toggleSelectAll = () => {
    setSelectedDeals(prev => {
      if (prev.size === deals.length) {
        return new Set();
      } else {
        return new Set(deals.map(d => d.id));
      }
    });
  };

  return (
    <>
      <ToastContainer />
      <div className="px-3 py-4 sm:p-6 space-y-4 max-w-full min-w-0">
        <div className="flex items-center justify-between gap-3 max-w-full">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold min-w-0 truncate">Deals</h1>
            {selectedDeals.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedDeals.size} selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="rounded-lg border border-red-300 px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-red-50 disabled:opacity-60 text-red-700 text-xs sm:text-sm whitespace-nowrap"
                >
                  {bulkDeleting ? 'Deleting…' : `Delete ${selectedDeals.size}`}
                </button>
              </div>
            )}
          </div>
          <Link
            href="/deals/new"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-white hover:opacity-90 text-sm whitespace-nowrap flex-shrink-0"
          >
            + New
          </Link>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full min-w-0">
        <div className="bg-white rounded-lg border p-3 min-w-0">
          <div className="text-xs text-gray-600">Total Deals</div>
          <div className="text-base font-semibold truncate">{deals.length}</div>
        </div>
        <div className="bg-white rounded-lg border p-3 min-w-0">
          <div className="text-xs text-gray-600">Open Deals</div>
          <div className="text-base font-semibold text-blue-600 truncate">{openDeals.length}</div>
        </div>
        <div className="bg-white rounded-lg border p-3 min-w-0">
          <div className="text-xs text-gray-600">Won Deals</div>
          <div className="text-base font-semibold text-green-600 truncate">{wonDeals.length}</div>
        </div>
        <div className="bg-white rounded-lg border p-3 min-w-0">
          <div className="text-xs text-gray-600">Total Value</div>
          <div className="text-base font-semibold truncate">{currency(totalValue)}</div>
        </div>
      </div>

      {/* Mobile Cards - visible on small screens */}
      <div className="lg:hidden w-full min-w-0 space-y-3">
        {deals.length === 0 ? (
          <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-gray-500">
            No deals found. Try syncing from HubSpot or create deals manually.
          </div>
        ) : (
          deals.map((deal) => (
            <div key={deal.id} className="bg-white rounded-xl border shadow-sm p-3 w-full min-w-0">
              <div className="flex items-start justify-between mb-2 gap-2 w-full min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedDeals.has(deal.id)}
                    onChange={() => toggleDealSelection(deal.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <Link 
                      href={`/deals/${deal.id}`}
                      className="font-medium text-blue-600 hover:underline text-sm block truncate"
                    >
                      {deal.title}
                    </Link>
                    {deal.client && (
                      <div className="text-xs text-gray-600 mt-1 truncate">
                        {deal.client.name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center flex-shrink-0">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getStageColor(deal.stage)}`}>
                    {deal.stage}
                  </span>
                  <button
                    onClick={() => handleDeleteDeal(deal.id)}
                    disabled={deletingDeal === deal.id}
                    className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                  >
                    {deletingDeal === deal.id ? '...' : 'Del'}
                  </button>
                </div>
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between w-full min-w-0">
                  <span className="text-gray-600 flex-shrink-0">Value:</span>
                  <span className="truncate ml-1 min-w-0 font-medium">{currency(deal.value_cents)}</span>
                </div>
                <div className="flex justify-between w-full min-w-0">
                  <span className="text-gray-600 flex-shrink-0">Probability:</span>
                  <span className="truncate ml-1 min-w-0">{deal.probability}%</span>
                </div>
                <div className="flex justify-between w-full min-w-0">
                  <span className="text-gray-600 flex-shrink-0">Expected Close:</span>
                  <span className="truncate ml-1 min-w-0">{formatDate(deal.expected_close_date)}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-gray-600 flex-shrink-0">Progress:</span>
                  <div className="h-1.5 w-12 rounded bg-gray-100 flex-shrink-0">
                    <div
                      className="h-1.5 rounded bg-emerald-500"
                      style={{ width: `${stageToProgress(deal.stage)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 text-xs">
                <span className={`inline-flex px-2 py-1 text-xs rounded ${
                  deal.source === 'hubspot' 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {deal.source || 'manual'}
                </span>
                <span className="text-gray-500">{formatDate(deal.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table - hidden on small screens */}
      <div className="hidden lg:block bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={deals.length > 0 && selectedDeals.size === deals.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3">Probability</th>
                <th className="px-4 py-3">Expected Close</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    No deals found. Try syncing from HubSpot or create deals manually.
                  </td>
                </tr>
              ) : (
                deals.map((deal) => (
                  <tr key={deal.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedDeals.has(deal.id)}
                        onChange={() => toggleDealSelection(deal.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/deals/${deal.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        <div className="font-medium">{deal.title}</div>
                      </Link>
                      {deal.hubspot_deal_id && (
                        <div className="text-xs text-gray-500">ID: {deal.hubspot_deal_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {deal.client ? (
                        <Link 
                          href={`/clients/${deal.client.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          <div className="font-medium">{deal.client.name}</div>
                          <div className="text-xs text-gray-500">{deal.client.email}</div>
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStageColor(deal.stage)}`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-24 rounded bg-gray-100">
                        <div
                          className="h-2 rounded bg-emerald-500"
                          style={{ width: `${stageToProgress(deal.stage)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {currency(deal.value_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{deal.probability}%</span>
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(deal.expected_close_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        deal.source === 'hubspot' 
                          ? 'bg-orange-100 text-orange-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {deal.source || 'manual'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(deal.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/deals/${deal.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          title="Edit Deal"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDeleteDeal(deal.id)}
                          disabled={deletingDeal === deal.id}
                          className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete Deal"
                        >
                          {deletingDeal === deal.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </>
  );
}