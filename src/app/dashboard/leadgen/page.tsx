import Link from "next/link";
import { requireOwner } from "@/lib/authz";
import {
  isAvailable,
  getStats,
  listBusinesses,
  listFollowUps,
  isRemoteBackend,
  type BusinessStatus,
} from "@/lib/leadgen-api";
import { LEADGEN_DB_PATH, PIPELINE_ROOT } from "@/lib/leadgen-paths";
import ProspectCard from "./ProspectCard";
import ProspectsExplorer from "./ProspectsExplorer";
import { MagnifyingGlassIcon, Cog6ToothIcon, EnvelopeIcon, PaperAirplaneIcon, ChartBarIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALL_STATUSES: (BusinessStatus | "all")[] = [
  "all",
  "new",
  "researched",
  "proposal_built",
  "contacted",
  "replied",
  "converted",
  "not_interested",
];

const STATUS_STYLES: Record<BusinessStatus, string> = {
  new:             "bg-blue-50 text-blue-700 border-blue-200",
  researched:      "bg-purple-50 text-purple-700 border-purple-200",
  proposal_built:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  contacted:       "bg-gray-100 text-gray-700 border-gray-200",
  // 'replied' is the hot signal — a warm orange so it jumps out of the list.
  replied:         "bg-orange-50 text-orange-700 border-orange-200",
  // 'converted' is the win — solid green.
  converted:       "bg-green-100 text-green-800 border-green-300",
  not_interested:  "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<BusinessStatus, string> = {
  new:             "New",
  researched:      "Researched",
  proposal_built:  "Proposal built",
  contacted:       "Contacted",
  replied:         "Replied",
  converted:       "Converted",
  not_interested:  "Not interested",
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

  // ── Empty state when the pipeline backend isn't reachable ────────
  if (!(await isAvailable())) {
    const remote = isRemoteBackend();
    return (
      <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
        <PageHeader />
        <div className="rounded-xl border bg-white p-6 text-sm space-y-3">
          <p className="font-medium text-gray-900">
            {remote ? "Pipeline API unreachable." : "Pipeline DB not found."}
          </p>
          {remote ? (
            <>
              <p className="text-gray-700">
                The dashboard couldn&apos;t reach the leadgen API. Check that
                the service is running at the URL below and that{" "}
                <code className="font-mono">LEADGEN_API_TOKEN</code> matches
                the deployed secret.
              </p>
              <code className="block bg-gray-50 border rounded px-3 py-2 font-mono text-xs">
                {process.env.LEADGEN_API_URL || "(unset)"}
              </code>
            </>
          ) : (
            <>
              <p className="text-gray-700">
                The dashboard reads from the automated-ai-pipeline&apos;s
                SQLite database. It expects to find{" "}
                <code className="font-mono">leads.db</code> at this path:
              </p>
              <code className="block bg-gray-50 border rounded px-3 py-2 font-mono text-xs">
                {LEADGEN_DB_PATH}
              </code>
              <p className="text-gray-700">
                Either run the pipeline once to create it, set{" "}
                <code className="font-mono">LEADGEN_DB_PATH</code> /{" "}
                <code className="font-mono">LEADGEN_PIPELINE_ROOT</code> in{" "}
                <code className="font-mono">.env.local</code>, or set{" "}
                <code className="font-mono">LEADGEN_API_URL</code> to point at
                the FastAPI service.
              </p>
              <p className="text-gray-500 text-xs">
                Detected pipeline root:{" "}
                <code className="font-mono">{PIPELINE_ROOT}</code>
              </p>
            </>
          )}
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

  // City filtering is no longer a URL param — the page now groups
  // businesses into a per-city accordion, so the operator drills in
  // by expanding sections rather than navigating between filters.
  const [stats, businesses, followUpsDue] = await Promise.all([
    getStats(),
    listBusinesses({ status: activeStatus, limit: 500 }),
    listFollowUps("due", 200),
  ]);

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <PageHeader />

      {/* ── Prospecting trigger ──────────────────────────────────── */}
      <ProspectCard />

      {/* ── Needs-attention banner ───────────────────────────────────
          Replies are the whole point — when a prospect responds, surface it
          loudly at the top and deep-link straight to the replied filter. */}
      {stats.by_status.replied > 0 && (
        <Link
          href="/dashboard/leadgen?status=replied"
          className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800 hover:bg-orange-100 transition"
        >
          <span className="flex items-center gap-2">
            <EnvelopeIcon className="w-5 h-5" />
            {stats.by_status.replied} lead{stats.by_status.replied === 1 ? "" : "s"} replied — needs your attention
          </span>
          <span aria-hidden className="text-orange-500">→</span>
        </Link>
      )}

      {/* ── Follow-ups due banner ────────────────────────────────── */}
      {followUpsDue.length > 0 && (
        <Link
          href="/dashboard/leadgen/follow-ups"
          className="flex items-center justify-between gap-3 rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm font-medium text-brand-black hover:bg-brand-yellow/20 transition"
        >
          <span className="flex items-center gap-2">
            <PaperAirplaneIcon className="w-5 h-5" />
            {followUpsDue.length} follow-up{followUpsDue.length === 1 ? "" : "s"} ready to review
          </span>
          <span aria-hidden className="text-gray-500">→</span>
        </Link>
      )}

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

      {/* ── Status filter chips ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_STATUSES.map((s) => {
          const isActive = activeStatus === s;
          const count =
            s === "all"
              ? stats.total
              : stats.by_status[s];
          const href =
            s === "all"
              ? "/dashboard/leadgen"
              : `/dashboard/leadgen?status=${s}`;
          return (
            <Link
              key={s}
              href={href}
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

      {/* ── Prospects: filter / sort / search + bulk actions ─────── */}
      <ProspectsExplorer businesses={businesses} />
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
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/leadgen/health"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50"
        >
          <ChartBarIcon className="w-4 h-4" />
          Health
        </Link>
        <Link
          href="/dashboard/leadgen/follow-ups"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50"
        >
          <PaperAirplaneIcon className="w-4 h-4" />
          Follow-ups
        </Link>
        <Link
          href="/dashboard/leadgen/settings"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50"
        >
          <Cog6ToothIcon className="w-4 h-4" />
          Profile
        </Link>
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

