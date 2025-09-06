'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { stageToProgress, currency } from '@/lib/progress';

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

  if (isLoading) return <div className="p-6">Loading deals…</div>;
  if (error || !data) return <div className="p-6 text-red-600">Failed to load deals</div>;

  const deals = data.deals || [];
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value_cents || 0), 0);
  const openDeals = deals.filter(deal => !['Won', 'Lost', 'Abandoned'].includes(deal.stage));
  const wonDeals = deals.filter(deal => deal.stage === 'Won');

  return (
    <div className="px-3 py-4 sm:p-6 space-y-4 max-w-full min-w-0">
      <div className="flex items-center justify-between gap-3 max-w-full">
        <h1 className="text-xl sm:text-2xl font-semibold min-w-0 truncate">Deals</h1>
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
                <div className="flex-shrink-0">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getStageColor(deal.stage)}`}>
                    {deal.stage}
                  </span>
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
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3">Probability</th>
                <th className="px-4 py-3">Expected Close</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No deals found. Try syncing from HubSpot or create deals manually.
                  </td>
                </tr>
              ) : (
                deals.map((deal) => (
                  <tr key={deal.id} className="border-t hover:bg-gray-50">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}