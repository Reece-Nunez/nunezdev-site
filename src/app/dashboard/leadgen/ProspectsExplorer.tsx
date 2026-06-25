"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  BeakerIcon,
  DocumentCheckIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { BusinessSummary } from "@/lib/leadgen-db";
import BusinessesTable from "./BusinessesTable";
import { bulkRunStage } from "./actions";
import {
  filterSortProspects,
  PROSPECT_SORTS,
  type ProspectSort,
  type Stage,
} from "./utils";

type TriState = "all" | "has" | "none";

const SELECT_CLS =
  "px-2.5 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400";

/**
 * Filter / sort / search over the prospect list, with multi-select bulk
 * actions. Operates client-side on the already-fetched list (status is applied
 * server-side via the chips above this). Filtering + sorting lives in the pure,
 * tested filterSortProspects helper.
 */
export default function ProspectsExplorer({ businesses }: { businesses: BusinessSummary[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState<TriState>("all");
  const [website, setWebsite] = useState<TriState>("all");
  const [city, setCity] = useState("all");
  const [sort, setSort] = useState<ProspectSort>("ai_desc");

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  const cities = useMemo(() => {
    const s = new Set<string>();
    for (const b of businesses) if (b.city) s.add(b.city);
    return [...s].sort();
  }, [businesses]);

  const results = useMemo(
    () => filterSortProspects(businesses, { search, email, website, city, sort }),
    [businesses, search, email, website, city, sort],
  );

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll(ids: number[], select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) (select ? next.add(id) : next.delete(id));
      return next;
    });
  }

  function dispatchBulk(stage: Stage, ids: number[]) {
    startTransition(async () => {
      const r = await bulkRunStage(stage, ids);
      if (r.ok) {
        toast.success(
          `Enqueued ${stage} for ${r.enqueued} lead${r.enqueued === 1 ? "" : "s"}` +
            (r.failed ? ` (${r.failed} failed)` : ""),
        );
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  // research + build call Claude per lead, so a large bulk run costs real
  // money — confirm those before firing. outreach only drafts (no send), and
  // small batches run one-click to keep the common flow fast.
  const CONFIRM_THRESHOLD = 100;

  function runBulk(stage: Stage) {
    const ids = [...selected];
    const costly = stage === "research" || stage === "build";
    if (costly && ids.length > CONFIRM_THRESHOLD) {
      toast(
        (t) => (
          <div className="text-sm">
            <div className="font-medium text-gray-900">
              Run {stage} on {ids.length} leads?
            </div>
            <div className="mt-0.5 text-gray-600">
              This enqueues {ids.length} Claude jobs and will use credits.
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  dispatchBulk(stage, ids);
                }}
                className="px-3 py-1 rounded-md text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800"
              >
                Run {ids.length}
              </button>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ),
        { duration: Infinity },
      );
      return;
    }
    dispatchBulk(stage, ids);
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, category, email, city…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>

        <select value={email} onChange={(e) => setEmail(e.target.value as TriState)} className={SELECT_CLS} aria-label="Email filter">
          <option value="all">Email: any</option>
          <option value="has">Has email</option>
          <option value="none">No email</option>
        </select>

        <select value={website} onChange={(e) => setWebsite(e.target.value as TriState)} className={SELECT_CLS} aria-label="Website filter">
          <option value="all">Website: any</option>
          <option value="has">Has website</option>
          <option value="none">No website</option>
        </select>

        {cities.length > 1 && (
          <select value={city} onChange={(e) => setCity(e.target.value)} className={SELECT_CLS} aria-label="City filter">
            <option value="all">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        <select value={sort} onChange={(e) => setSort(e.target.value as ProspectSort)} className={SELECT_CLS} aria-label="Sort">
          {PROSPECT_SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          Showing {results.length} of {businesses.length}
          {results.length !== businesses.length ? " (filtered)" : ""}
        </span>
        {(search || email !== "all" || website !== "all" || city !== "all") && (
          <button
            type="button"
            onClick={() => { setSearch(""); setEmail("all"); setWebsite("all"); setCity("all"); }}
            className="text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Bulk action bar (sticky top while leads are selected) ──── */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-gray-900">{selected.size} selected</span>
          <span className="text-gray-300">·</span>
          <BulkButton onClick={() => runBulk("research")} disabled={isPending} icon={BeakerIcon}>Research</BulkButton>
          <BulkButton onClick={() => runBulk("build")} disabled={isPending} icon={DocumentCheckIcon}>Build</BulkButton>
          <BulkButton onClick={() => runBulk("outreach")} disabled={isPending} icon={PaperAirplaneIcon}>Outreach</BulkButton>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={isPending}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            <XMarkIcon className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {results.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          No prospects match these filters.
        </div>
      ) : (
        <BusinessesTable
          businesses={results}
          selectedIds={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
        />
      )}
    </div>
  );
}

function BulkButton({
  onClick,
  disabled,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}
