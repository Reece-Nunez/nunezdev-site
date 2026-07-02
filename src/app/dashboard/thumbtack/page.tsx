import { redirect } from 'next/navigation';
import { requireProspecting } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import {
  computeThumbtackRoi,
  nameKey,
  type RoiLead,
  type RoiClient,
  type ThumbtackRoi,
} from '@/lib/thumbtackRoi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function dollars(cents: number | null) {
  return cents == null ? null : `$${(cents / 100).toFixed(2)}`;
}

type SupabaseAdmin = ReturnType<typeof supabaseAdmin>;

/** Strip the "Lead - " / "Thumbtack lead fee - " prefix off an expense
 *  description to recover the customer name. */
function leadNameFromDescription(description: string | null): string | null {
  if (!description) return null;
  return description.replace(/^(thumbtack lead fee|lead)\s*[-–]\s*/i, '').trim() || null;
}

/**
 * Load every Thumbtack lead from the **lead-fee expenses** (vendor='Thumbtack')
 * — the real source of truth for spend + leads, since the webhook only fires
 * for a fraction of leads ("Direct leads" never generate an event). Enrich with
 * phone/link from the leads table (best-effort, by name), match each lead to a
 * client (link → phone → name), and roll up spend vs. collected revenue.
 * Matching + math live in the pure, unit-tested @/lib/thumbtackRoi.
 */
async function loadThumbtackRoi(supabase: SupabaseAdmin): Promise<ThumbtackRoi> {
  // 1. Lead list + spend = the Thumbtack lead-fee expenses.
  const { data: expenses } = await supabase
    .from('expenses')
    .select('description, amount_cents, expense_date, client_id')
    .eq('vendor', 'Thumbtack')
    .order('expense_date', { ascending: false });

  // 2. Phone + explicit link enrichment from the leads table, keyed by name.
  const { data: leadRows } = await supabase
    .from('leads')
    .select('name, phone, client_id')
    .eq('source', 'thumbtack');
  const phoneByName = new Map<string, string>();
  const linkByName = new Map<string, string>();
  for (const l of (leadRows ?? []) as { name: string | null; phone: string | null; client_id: string | null }[]) {
    const nk = nameKey(l.name);
    if (!nk) continue;
    if (l.phone && !phoneByName.has(nk)) phoneByName.set(nk, l.phone);
    if (l.client_id && !linkByName.has(nk)) linkByName.set(nk, l.client_id);
  }

  const leads: RoiLead[] = ((expenses ?? []) as {
    description: string | null;
    amount_cents: number | null;
    expense_date: string | null;
    client_id: string | null;
  }[]).map((e) => {
    const name = leadNameFromDescription(e.description);
    const nk = nameKey(name);
    return {
      negotiationId: null,
      name,
      phone: nk ? phoneByName.get(nk) ?? null : null,
      priceCents: e.amount_cents ?? null,
      dateISO: e.expense_date ?? null,
      linkedClientId: e.client_id ?? (nk ? linkByName.get(nk) ?? null : null),
    };
  });

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
  const roi = await loadThumbtackRoi(supabase);

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Thumbtack ROI</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every Thumbtack lead fee (logged to{' '}
            <a href="/dashboard/expenses" className="text-emerald-700 hover:underline">
              Expenses
            </a>
            ) cross-referenced against your invoices to show what Thumbtack is actually
            earning you.
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

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {roi.rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            No Thumbtack lead fees logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead fee</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Lead date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Matched client</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {roi.rows.map((r, i) => {
                  const tone: BadgeTone =
                    r.outcome === 'won' ? 'success' : r.outcome === 'in_progress' ? 'info' : 'muted';
                  const label =
                    r.outcome === 'won' ? 'Won' : r.outcome === 'in_progress' ? 'In progress' : 'No match';
                  return (
                    <tr key={r.negotiationId ?? `${r.name}-${i}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {r.name ?? <span className="text-gray-400">Unknown</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {dollars(r.priceCents) ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap hidden sm:table-cell">
                        {r.dateISO ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={tone}>{label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 hidden md:table-cell">
                        {r.clientName ? (
                          <span>
                            {r.clientName}
                            {r.confidence && (
                              <span className="text-[11px] text-gray-400"> · {r.confidence}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {r.clientRevenueCents > 0 ? dollars(r.clientRevenueCents) : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
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
