import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProspecting } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { Badge, type BadgeTone } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
  source: string;
  lead_source: string | null;
  project_type: string | null;
  budget: string | null;
  created_at: string;
  client_id: string | null;
  tags: string[] | null;
};

const STATUS_FILTERS = ['active', 'new', 'contacted', 'qualified', 'converted', 'lost', 'offshore'] as const;
// 'active' = default daily-triage view: everything that's still in your funnel.
// Hides 'converted' (already a client) and 'lost' (preserved for analytics but noise day-to-day).
const ACTIVE_STATUSES = ['new', 'contacted', 'nurturing', 'qualified'] as const;

// Geo-quarantined junk (see lib/leadGeo). Tagged 'offshore' on intake; hidden
// from every normal view and surfaced only under the dedicated 'offshore' chip
// so it stays reviewable without cluttering daily triage.
const OFFSHORE_TAG = 'offshore';
const isOffshore = (tags: string[] | null) =>
  Array.isArray(tags) && tags.includes(OFFSHORE_TAG);

const STATUS_TONE: Record<string, BadgeTone> = {
  new: 'info',
  contacted: 'warning',
  nurturing: 'purple',
  qualified: 'success',
  converted: 'success',
  lost: 'muted',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const guard = await requireProspecting();
  if (!guard.ok) redirect('/login?next=/dashboard/leads');

  const { status: statusFilter } = await searchParams;
  // Default to 'active' (in-funnel only) so closed leads don't clutter daily triage.
  const effectiveFilter = statusFilter || 'active';
  const supabase = supabaseAdmin();

  let query = supabase
    .from('leads')
    .select(
      'id, name, email, phone, company, status, source, lead_source, project_type, budget, created_at, client_id, tags'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (effectiveFilter === 'active') {
    query = query.in('status', [...ACTIVE_STATUSES]);
  } else if (effectiveFilter !== 'offshore') {
    // Offshore is a tag, not a status — it spans statuses, so don't constrain
    // by status here; the tag filter below narrows it.
    query = query.eq('status', effectiveFilter);
  }

  const { data: leads = [], error } = await query;

  // The offshore tag is filtered in memory (not in the query) to avoid the
  // three-valued-logic trap where a NULL-tags row would vanish from a
  // `NOT tags @> '{offshore}'` filter. The 200-row cap keeps this cheap.
  const rawRows = (leads || []) as LeadRow[];
  const rows =
    effectiveFilter === 'offshore'
      ? rawRows.filter((l) => isOffshore(l.tags))
      : rawRows.filter((l) => !isOffshore(l.tags));

  // Status counts for the filter chips. Offshore leads are counted only under
  // the 'offshore' chip and removed from every status/active count so the
  // numbers match what the table actually shows.
  const { data: allForCount } = await supabase.from('leads').select('status, tags');
  const counts = (allForCount || []).reduce<Record<string, number>>((acc, l) => {
    if (isOffshore(l.tags as string[] | null)) {
      acc.offshore = (acc.offshore || 0) + 1;
      return acc;
    }
    acc[l.status] = (acc[l.status] || 0) + 1;
    if ((ACTIVE_STATUSES as readonly string[]).includes(l.status)) {
      acc.active = (acc.active || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            Inquiries from your contact forms and audit requests.
          </p>
        </div>
      </header>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => {
          const isActive = effectiveFilter === status;
          const count = counts[status] || 0;
          const label =
            status === 'active'
              ? 'Active'
              : status.charAt(0).toUpperCase() + status.slice(1);
          return (
            <Link
              key={status}
              href={status === 'active' ? '/dashboard/leads' : `/dashboard/leads?status=${status}`}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}{' '}
              <span className={isActive ? 'text-white/60' : 'text-gray-400'}>({count})</span>
            </Link>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load leads: {error.message}
        </div>
      )}

      {/* Leads table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            {effectiveFilter === 'active'
              ? counts.active === 0 && (counts.lost || counts.converted)
                ? 'No active leads. Switch a filter chip above to see closed leads.'
                : 'No leads yet. New form submissions will show up here automatically.'
              : effectiveFilter === 'offshore'
                ? 'No quarantined (offshore) leads.'
                : `No leads with status "${effectiveFilter}".`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Project
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Budget
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Source
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Received
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/leads/${lead.id}`} className="block">
                        <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                        <div className="text-xs text-gray-500">
                          {lead.email}
                          {lead.company ? ` · ${lead.company}` : ''}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[lead.status] ?? 'neutral'}>{lead.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 hidden md:table-cell">
                      {lead.project_type || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 hidden lg:table-cell">
                      {lead.budget || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                      {lead.lead_source || lead.source}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(lead.created_at)}
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
