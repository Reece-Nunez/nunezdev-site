import Link from "next/link";
import { requireOwner } from "@/lib/authz";
import {
  isAvailable,
  getStats,
  listBusinesses,
  type BusinessStatus,
  type BusinessSummary,
} from "@/lib/leadgen-db";
import { LEADGEN_DB_PATH, PIPELINE_ROOT } from "@/lib/leadgen-paths";
import { aiScoreClass } from "./utils";
import { MagnifyingGlassIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALL_STATUSES: (BusinessStatus | "all")[] = [
  "all",
  "new",
  "researched",
  "proposal_built",
  "contacted",
];

const STATUS_STYLES: Record<BusinessStatus, string> = {
  new:             "bg-blue-50 text-blue-700 border-blue-200",
  researched:      "bg-purple-50 text-purple-700 border-purple-200",
  proposal_built:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  contacted:       "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_LABELS: Record<BusinessStatus, string> = {
  new:             "New",
  researched:      "Researched",
  proposal_built:  "Proposal built",
  contacted:       "Contacted",
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function LeadgenIndex({ searchParams }: PageProps) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return (
      <div className="px-3 py-4 sm:p-6 max-w-full min-w-0">
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          You do not have owner access to view the prospecting dashboard.
        </div>
      </div>
    );
  }

  // ── Empty state when the pipeline DB isn't reachable ─────────────
  if (!isAvailable()) {
    return (
      <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
        <PageHeader />
        <div className="rounded-xl border bg-white p-6 text-sm space-y-3">
          <p className="font-medium text-gray-900">Pipeline DB not found.</p>
          <p className="text-gray-700">
            The dashboard reads from the automated-ai-pipeline&apos;s SQLite
            database. It expects to find <code className="font-mono">leads.db</code>{" "}
            at this path:
          </p>
          <code className="block bg-gray-50 border rounded px-3 py-2 font-mono text-xs">
            {LEADGEN_DB_PATH}
          </code>
          <p className="text-gray-700">
            Either run the pipeline once to create it, or set
            {" "}<code className="font-mono">LEADGEN_DB_PATH</code>{" "}
            and{" "}<code className="font-mono">LEADGEN_PIPELINE_ROOT</code>{" "}
            in <code className="font-mono">.env.local</code> to point at the
            pipeline you want to use.
          </p>
          <p className="text-gray-500 text-xs">
            Detected pipeline root: <code className="font-mono">{PIPELINE_ROOT}</code>
          </p>
        </div>
      </div>
    );
  }

  // ── Status filter from query string ──────────────────────────────
  const params = await searchParams;
  const rawStatus = params.status ?? "all";
  const activeStatus: BusinessStatus | "all" = (ALL_STATUSES as string[]).includes(rawStatus)
    ? (rawStatus as BusinessStatus | "all")
    : "all";

  const stats = getStats();
  const businesses = listBusinesses({
    status: activeStatus,
    limit: 200,
  });

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <PageHeader />

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Prospected" value={stats.total.toString()} />
        <StatCard
          label="Researched"
          value={stats.by_status.researched.toString()}
          sub={`${stats.by_status.new} pending`}
        />
        <StatCard
          label="Proposal built"
          value={stats.by_status.proposal_built.toString()}
          sub={`${stats.by_status.contacted} contacted`}
        />
        <StatCard
          label="Pipeline value"
          value={formatCurrency(stats.total_pipeline_value)}
          sub={stats.avg_ai_score != null ? `avg AI ${stats.avg_ai_score}/10` : undefined}
        />
      </div>

      {/* ── Filter chips ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_STATUSES.map((s) => {
          const isActive = activeStatus === s;
          const count =
            s === "all"
              ? stats.total
              : stats.by_status[s];
          return (
            <Link
              key={s}
              href={s === "all" ? "/dashboard/leadgen" : `/dashboard/leadgen?status=${s}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
                ${isActive
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s as BusinessStatus]}
              <span className={`ml-2 ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Businesses table ─────────────────────────────────────── */}
      {businesses.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          No businesses match this filter.
        </div>
      ) : (
        <BusinessesTable businesses={businesses} />
      )}
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MagnifyingGlassIcon className="w-6 h-6 text-gray-600" />
          Prospecting
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Automated outbound: find local businesses, score their digital
          presence, draft personalised proposals + outreach.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function BusinessesTable({ businesses }: { businesses: BusinessSummary[] }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Business</th>
              <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Category</th>
              <th className="text-center px-3 py-2.5 font-medium w-20">AI</th>
              <th className="text-center px-3 py-2.5 font-medium w-20 hidden sm:table-cell">Reviews</th>
              <th className="text-center px-3 py-2.5 font-medium">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {businesses.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/leadgen/${b.id}`}
                    className="font-medium text-gray-900 hover:text-blue-700"
                  >
                    {b.name}
                  </Link>
                  {b.address && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate max-w-md">
                      {b.address}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                  {b.category ?? "—"}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex items-center justify-center w-12 px-2 py-1 rounded-full text-xs font-semibold border tabular-nums ${aiScoreClass(
                      b.ai_score
                    )}`}
                  >
                    {b.ai_score != null ? `${b.ai_score}/10` : "—"}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-gray-600 tabular-nums hidden sm:table-cell">
                  {b.review_count != null ? (
                    <>
                      {b.rating != null && (
                        <span className="text-gray-900">{b.rating}★</span>
                      )}
                      <span className="text-gray-500"> · {b.review_count}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${STATUS_STYLES[b.status]}`}
                  >
                    {STATUS_LABELS[b.status]}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={`/dashboard/leadgen/${b.id}`}
                    className="text-gray-400 hover:text-gray-700"
                    aria-label={`Open ${b.name}`}
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
