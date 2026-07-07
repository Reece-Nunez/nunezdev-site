import Link from "next/link";
import { requireProspecting } from "@/lib/authz";
import {
  isAvailable,
  getStats,
  listBusinesses,
  listFollowUps,
  isRemoteBackend,
  type BusinessStatus,
} from "@/lib/leadgen-api";
import { LEADGEN_DB_PATH, PIPELINE_ROOT } from "@/lib/leadgen-paths";
import { countUnansweredReplyLeads } from "@/lib/leadgenInbox";
import ProspectCard from "./ProspectCard";
import ProspectsExplorer from "./ProspectsExplorer";
import { BUSINESS_STATUS_LABEL, tallyByStatus } from "./utils";
import { MagnifyingGlassIcon, Cog6ToothIcon, EnvelopeIcon, PaperAirplaneIcon, ChartBarIcon, MegaphoneIcon } from "@heroicons/react/24/outline";

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
  const guard = await requireProspecting();
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
  // One fetch drives BOTH the filter chips and the table below, so a chip's
  // count can never disagree with the rows you see when you click it. (The
  // pipeline's /stats counts archived leads that the /businesses list omits —
  // reading counts from the list itself keeps the two in sync.) The limit is
  // generous headroom over the active set, which runs a few hundred leads.
  const [stats, allBusinesses, followUpsDue] = await Promise.all([
    getStats(),
    listBusinesses({ limit: 1000 }),
    listFollowUps("due", 200),
  ]);

  // Archived = low-opportunity leads auto-hidden from the default view. Exclude
  // them everywhere (chips, cards, table) so nothing counts leads you can't see.
  const visible = allBusinesses.filter((b) => !b.archived);
  const archivedCount = allBusinesses.length - visible.length;
  const tally = tallyByStatus(visible);
  const businesses =
    activeStatus === "all"
      ? visible
      : visible.filter((b) => b.status === activeStatus);
  const repliedBusinesses = visible.filter((b) => b.status === "replied");

  // The banner counts only replied leads we haven't answered yet in the inbox,
  // so it clears once you reply (see leadgenInbox). Falls back to the tallied
  // replied count if the inbox lookup errors — never silently hide a reply.
  const unanswered = await countUnansweredReplyLeads(
    repliedBusinesses.map((b) => ({ id: b.id, phone: b.phone, email: b.email })),
  );
  const attentionCount = unanswered ?? tally.byStatus.replied;

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <PageHeader />

      {/* ── Prospecting trigger ──────────────────────────────────── */}
      <ProspectCard />

      {/* ── Needs-attention banner ───────────────────────────────────
          Replies are the whole point — when a prospect responds, surface it
          loudly at the top and deep-link straight to the replied filter. */}
      {attentionCount > 0 && (
        <Link
          href="/dashboard/leadgen?status=replied"
          className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800 hover:bg-orange-100 transition"
        >
          <span className="flex items-center gap-2">
            <EnvelopeIcon className="w-5 h-5" />
            {attentionCount} lead{attentionCount === 1 ? "" : "s"} replied — needs your attention
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
        <StatCard
          label="Prospected"
          value={tally.total.toString()}
          sub={archivedCount > 0 ? `${archivedCount} archived` : undefined}
        />
        <StatCard
          label="Researched"
          value={tally.byStatus.researched.toString()}
          sub={`${tally.byStatus.new} pending`}
        />
        <StatCard
          label="Proposal built"
          value={tally.byStatus.proposal_built.toString()}
          sub={`${tally.byStatus.contacted} contacted`}
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
          const count = s === "all" ? tally.total : tally.byStatus[s];
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
              {s === "all" ? "All" : BUSINESS_STATUS_LABEL[s as BusinessStatus]}
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
          href="/dashboard/leadgen/ads"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50"
        >
          <MegaphoneIcon className="w-4 h-4" />
          Ads
        </Link>
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

