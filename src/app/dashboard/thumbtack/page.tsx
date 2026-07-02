import { redirect } from 'next/navigation';
import { requireProspecting } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { extractLeadDetails, isThumbtackLeadEvent } from '@/lib/thumbtackWebhook';
import {
  computeThumbtackRoi,
  type RoiLead,
  type RoiClient,
  type ThumbtackRoi,
} from '@/lib/thumbtackRoi';

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

type SupabaseAdmin = ReturnType<typeof supabaseAdmin>;

/**
 * Load every Thumbtack lead straight from the raw events (deduped by
 * negotiation), match each to a client (explicit link → phone → name), and roll
 * up spend vs. collected revenue. Reading from the events — not the derived
 * leads/expenses tables — means the ROI reflects ALL leads regardless of
 * whether the processor has caught up. Matching + math live in the pure,
 * unit-tested @/lib/thumbtackRoi.
 */
async function loadThumbtackRoi(supabase: SupabaseAdmin): Promise<ThumbtackRoi> {
  // 1. All lead events → one RoiLead per negotiation.
  const { data: events } = await supabase
    .from('thumbtack_events')
    .select('event_type, payload')
    .order('received_at', { ascending: false })
    .limit(5000);

  const detailByNeg = new Map<string, ReturnType<typeof extractLeadDetails>>();
  const anonLeads: RoiLead[] = [];
  for (const e of (events ?? []) as { event_type: string | null; payload: unknown }[]) {
    if (!isThumbtackLeadEvent(e.event_type)) continue;
    const d = extractLeadDetails(e.payload);
    if (d.negotiationID) {
      if (!detailByNeg.has(d.negotiationID)) detailByNeg.set(d.negotiationID, d);
    } else {
      anonLeads.push({
        negotiationId: null,
        name: d.customerName,
        phone: d.customerPhone,
        priceCents: d.leadPriceCents,
        dateISO: d.createdAtDate,
      });
    }
  }

  // 2. Explicit lead→client links (converted leads) keyed by negotiation id.
  const negIds = [...detailByNeg.keys()];
  const linkByNeg = new Map<string, string>();
  if (negIds.length) {
    const { data: leadRows } = await supabase
      .from('leads')
      .select('thumbtack_negotiation_id, client_id')
      .in('thumbtack_negotiation_id', negIds);
    for (const l of (leadRows ?? []) as { thumbtack_negotiation_id: string | null; client_id: string | null }[]) {
      if (l.thumbtack_negotiation_id && l.client_id) linkByNeg.set(l.thumbtack_negotiation_id, l.client_id);
    }
  }

  const leads: RoiLead[] = [
    ...anonLeads,
    ...[...detailByNeg.entries()].map(([neg, d]) => ({
      negotiationId: neg,
      name: d.customerName,
      phone: d.customerPhone,
      priceCents: d.leadPriceCents,
      dateISO: d.createdAtDate,
      linkedClientId: linkByNeg.get(neg) ?? null,
    })),
  ];

  // 3. Clients to match against.
  const { data: clientRows } = await supabase.from('clients').select('id, name, phone, email');
  const clients: RoiClient[] = ((clientRows ?? []) as RoiClient[]).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
  }));

  // 4. Collected (paid) cents per client, across all their invoices.
  const { data: invoices } = await supabase.from('invoices').select('id, client_id');
  const clientByInvoice = new Map<string, string>();
  for (const inv of (invoices ?? []) as { id: string; client_id: string | null }[]) {
    if (inv.client_id) clientByInvoice.set(inv.id, inv.client_id);
  }
  const invoiceIds = [...clientByInvoice.keys()];
  const collectedByClientId: Record<string, number> = {};
  if (invoiceIds.length) {
    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('invoice_id, amount_cents')
      .in('invoice_id', invoiceIds);
    for (const p of (payments ?? []) as { invoice_id: string; amount_cents: number | null }[]) {
      const cid = clientByInvoice.get(p.invoice_id);
      if (cid) collectedByClientId[cid] = (collectedByClientId[cid] ?? 0) + (p.amount_cents ?? 0);
    }
  }

  return computeThumbtackRoi(leads, clients, collectedByClientId);
}

export default async function ThumbtackLeadsPage() {
  const guard = await requireProspecting();
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

  const roi = await loadThumbtackRoi(supabase);
  // Per-lead outcome (won / in progress / unmatched) keyed by negotiation id,
  // so the recent-leads table below can show which fees actually paid off.
  const roiByNeg = new Map(roi.rows.filter((r) => r.negotiationId).map((r) => [r.negotiationId!, r]));

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
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Stat label="Lead spend" value={dollars(roi.spendCents) ?? '$0.00'} />
        <Stat label="Revenue collected" value={dollars(roi.revenueCents) ?? '$0.00'} />
        <Stat
          label="Net profit"
          value={dollars(roi.netCents) ?? '$0.00'}
          valueClass={roi.netCents >= 0 ? 'text-emerald-700' : 'text-red-600'}
        />
        <Stat
          label="ROI"
          value={roi.roiMultiple == null ? '—' : `${roi.roiMultiple.toFixed(1)}×`}
          sub={roi.roiPct == null ? undefined : `${roi.roiPct >= 0 ? '+' : ''}${roi.roiPct.toFixed(0)}%`}
        />
        <Stat label="Total leads" value={String(roi.leadCount)} />
        <Stat
          label="Clients won"
          value={String(roi.wonClientCount)}
          sub={`of ${roi.matchedClientCount} matched`}
        />
        <Stat
          label="Win rate"
          value={roi.winRate == null ? '—' : `${(roi.winRate * 100).toFixed(0)}%`}
          sub="won ÷ leads"
        />
        <Stat label="Avg cost / lead" value={dollars(roi.avgCostPerLeadCents) ?? '—'} />
      </div>

      <p className="text-xs text-gray-400 -mt-3">
        Revenue = all payments collected from clients matched to a Thumbtack lead (by
        converted-lead link, phone, or name). A lead is &ldquo;won&rdquo; once its client has paid.
      </p>

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
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome</th>
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
                    <td className="px-4 py-3">
                      {(() => {
                        const r = lead.negotiationID ? roiByNeg.get(lead.negotiationID) : undefined;
                        if (!r) return <span className="text-gray-400 text-xs">—</span>;
                        const tone: BadgeTone =
                          r.outcome === 'won' ? 'success' : r.outcome === 'in_progress' ? 'info' : 'muted';
                        const label =
                          r.outcome === 'won' ? 'Won' : r.outcome === 'in_progress' ? 'In progress' : 'No match';
                        return (
                          <div className="flex flex-col items-start gap-0.5">
                            <Badge tone={tone}>{label}</Badge>
                            {r.clientRevenueCents > 0 && (
                              <span className="text-xs text-gray-500">
                                {dollars(r.clientRevenueCents)}
                                {r.clientName ? ` · ${r.clientName}` : ''}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge tone="info">{lead.status || 'lead'}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {row.processed ? (
                        <Badge tone="success">In expenses</Badge>
                      ) : (
                        <Badge tone="warning">Pending</Badge>
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

function Stat({
  label,
  value,
  sub,
  valueClass = 'text-gray-900',
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-semibold ${valueClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
