import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { extractLeadDetails, isThumbtackLeadEvent } from '@/lib/thumbtackWebhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type EventRow = {
  id: string;
  event_type: string | null;
  payload: unknown;
  processed: boolean;
  received_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dollars(cents: number | null) {
  return cents == null ? null : `$${(cents / 100).toFixed(2)}`;
}

export default async function ThumbtackLeadsPage() {
  const guard = await requireOwner();
  if (!guard.ok) redirect('/login?next=/dashboard/thumbtack');

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('thumbtack_events')
    .select('id, event_type, payload, processed, received_at')
    .order('received_at', { ascending: false })
    .limit(200);

  // Lead events only (messages/reviews live in the inbox). Decorate each with
  // the parsed display fields.
  const leads = ((data ?? []) as EventRow[])
    .filter((e) => isThumbtackLeadEvent(e.event_type))
    .map((e) => ({ row: e, lead: extractLeadDetails(e.payload) }));

  const totalCents = leads.reduce((sum, l) => sum + (l.lead.leadPriceCents ?? 0), 0);

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Thumbtack Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            Leads pushed in live from Thumbtack. Lead fees are logged automatically to{' '}
            <a href="/dashboard/expenses" className="text-emerald-700 hover:underline">
              Expenses
            </a>{' '}
            (Thumbtack / lead&nbsp;fees) — no manual entry.
          </p>
        </div>
        {leads.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Lead spend (shown)</div>
            <div className="text-lg font-semibold text-gray-900">{dollars(totalCents)}</div>
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load Thumbtack leads: {error.message}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {leads.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            No Thumbtack leads yet. New leads will appear here automatically as Thumbtack
            sends them.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Service</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead fee</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Logged</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {leads.map(({ row, lead }) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {lead.customerName ?? <span className="text-gray-400">Unknown</span>}
                      </div>
                      {lead.customerPhone && (
                        <div className="text-xs text-gray-500">{lead.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 hidden md:table-cell">
                      {lead.category || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {dollars(lead.leadPriceCents) ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-flex text-xs px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                        {lead.status || 'lead'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {row.processed ? (
                        <span className="inline-flex text-xs px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                          In expenses
                        </span>
                      ) : (
                        <span className="inline-flex text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(row.received_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
