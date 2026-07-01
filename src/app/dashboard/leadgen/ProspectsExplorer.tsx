"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { bulkRunStage, bulkJobProgress, cancelBulkRun } from "./actions";
import {
  filterSortProspects,
  PROSPECT_SORTS,
  type ProspectSort,
  type Stage,
} from "./utils";

type TriState = "all" | "has" | "none";
type MobileFilter = "all" | "mobile" | "not_mobile";

// Filters persist across navigation (e.g. opening a prospect detail page and
// hitting back) via sessionStorage — scoped to the tab, cleared when it closes.
const FILTERS_KEY = "leadgen:prospect-filters";

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
  const [mobile, setMobile] = useState<MobileFilter>("all");
  const [city, setCity] = useState("all");
  const [sort, setSort] = useState<ProspectSort>("ai_desc");
  // Gates persistence until after the one-time restore so the initial mount
  // doesn't overwrite stored filters with the defaults above.
  const [hydrated, setHydrated] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Live progress of an in-flight bulk run (research/build/outreach over many
  // leads). Jobs drain one at a time on the pipeline's single worker, so a big
  // run takes a while — this lets the operator watch it move instead of waiting
  // blind.
  const [bulkRun, setBulkRun] = useState<{
    stage: Stage;
    total: number;
    jobIds: string[];
    done: number;
    failed: number;
    startedAt: number;
  } | null>(null);
  const pollRef = useRef(0);

  // 1s ticker so the elapsed/ETA readout updates smoothly between polls.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!bulkRun) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [bulkRun]);

  // Poll the batch-progress endpoint until every job is terminal. Keyed on the
  // jobIds array identity, which only changes when a NEW run starts.
  useEffect(() => {
    if (!bulkRun) return;
    const myPoll = ++pollRef.current;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (pollRef.current !== myPoll) return;
      const p = await bulkJobProgress(bulkRun.jobIds);
      if (pollRef.current !== myPoll) return;
      if (p.ok) {
        const done = p.completed + p.failed;
        setBulkRun((cur) => (cur ? { ...cur, done, failed: p.failed } : cur));
        if (done >= bulkRun.total) {
          toast.success(
            `${bulkRun.stage} finished — ${p.completed} done` +
              (p.failed ? `, ${p.failed} failed` : ""),
          );
          router.refresh();
          setBulkRun(null);
          return;
        }
      }
      timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 1500);
    return () => {
      pollRef.current++;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkRun?.jobIds]);

  // Restore persisted filters once on mount. Done in an effect (not lazy state
  // init) so the server-rendered and first client render match — no hydration
  // mismatch. setHydrated then unlocks the persist effect below.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FILTERS_KEY);
      if (raw) {
        const f = JSON.parse(raw);
        if (typeof f.search === "string") setSearch(f.search);
        if (f.email === "all" || f.email === "has" || f.email === "none") setEmail(f.email);
        if (f.website === "all" || f.website === "has" || f.website === "none") setWebsite(f.website);
        if (f.mobile === "all" || f.mobile === "mobile" || f.mobile === "not_mobile") setMobile(f.mobile);
        if (typeof f.city === "string") setCity(f.city);
        if (PROSPECT_SORTS.some((s) => s.value === f.sort)) setSort(f.sort);
      }
    } catch {
      // Corrupt/blocked storage — fall back to defaults.
    }
    setHydrated(true);
  }, []);

  // Persist filters on change (after restore). Keyed on `hydrated` so the first
  // post-restore render is what writes — never the pre-restore default render.
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ search, email, website, mobile, city, sort }),
      );
    } catch {
      // Storage full/blocked — non-fatal, filters just won't persist.
    }
  }, [hydrated, search, email, website, mobile, city, sort]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    for (const b of businesses) if (b.city) s.add(b.city);
    return [...s].sort();
  }, [businesses]);

  const results = useMemo(
    () => filterSortProspects(businesses, { search, email, website, mobile, city, sort }),
    [businesses, search, email, website, mobile, city, sort],
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
  // Quick-select the first N of the current (filtered + sorted) list. Default
  // sort is AI score high→low, so "Top 100" = the 100 strongest leads — the
  // batch size the pipeline is happy with. Replaces the current selection.
  function selectTopN(n: number) {
    setSelected(new Set(results.slice(0, n).map((b) => b.id)));
  }

  function dispatchBulk(stage: Stage, ids: number[]) {
    startTransition(async () => {
      const r = await bulkRunStage(stage, ids);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setSelected(new Set());
      if (r.jobIds.length === 0) {
        toast.error(
          `Couldn't enqueue any ${stage} jobs` + (r.failed ? ` (${r.failed} failed)` : ""),
        );
        return;
      }
      toast.success(
        `Started ${stage} on ${r.enqueued} lead${r.enqueued === 1 ? "" : "s"}` +
          (r.failed ? ` (${r.failed} failed to enqueue)` : ""),
      );
      // Hand off to the progress bar — it polls until every job is terminal,
      // then refreshes the list.
      setBulkRun({
        stage,
        total: r.jobIds.length,
        jobIds: r.jobIds,
        done: 0,
        failed: 0,
        startedAt: Date.now(),
      });
    });
  }

  function stopBulkRun() {
    const run = bulkRun;
    if (!run) return;
    // Hide the bar + stop polling immediately (the effect cleanup bumps
    // pollRef), then cancel the pending jobs server-side so the worker skips
    // them. The job currently mid-flight finishes on its own.
    setBulkRun(null);
    startTransition(async () => {
      const r = await cancelBulkRun(run.jobIds);
      if (r.ok) {
        toast.success(
          `Stopped — cancelled ${r.cancelled} pending job${r.cancelled === 1 ? "" : "s"}`,
        );
      } else {
        toast.error(r.message);
      }
      router.refresh();
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

        <select value={mobile} onChange={(e) => setMobile(e.target.value as MobileFilter)} className={SELECT_CLS} aria-label="Phone type filter">
          <option value="all">Phone: any</option>
          <option value="mobile">Mobile only</option>
          <option value="not_mobile">Not mobile</option>
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          Showing {results.length} of {businesses.length}
          {results.length !== businesses.length ? " (filtered)" : ""}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {results.length > 0 && (
            <>
              <span className="text-gray-400">Quick select:</span>
              {[25, 50, 100].filter((n) => n < results.length).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => selectTopN(n)}
                  className="px-2 py-0.5 rounded-md border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
                >
                  Top {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => selectTopN(results.length)}
                className="px-2 py-0.5 rounded-md border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
              >
                All {results.length}
              </button>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="px-2 py-0.5 rounded-md text-gray-500 hover:text-gray-900"
                >
                  Clear
                </button>
              )}
              <span className="text-gray-300">·</span>
            </>
          )}
          {(search || email !== "all" || website !== "all" || mobile !== "all" || city !== "all") && (
            <button
              type="button"
              onClick={() => { setSearch(""); setEmail("all"); setWebsite("all"); setMobile("all"); setCity("all"); }}
              className="text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Live bulk-run progress (sticky while a run is in flight) ── */}
      {bulkRun && (() => {
        const pct = bulkRun.total ? Math.round((bulkRun.done / bulkRun.total) * 100) : 0;
        const elapsedSec = Math.max(0, Math.floor((Date.now() - bulkRun.startedAt) / 1000));
        const secPerJob = bulkRun.done > 0 ? elapsedSec / bulkRun.done : 0;
        const etaSec = secPerJob > 0 ? Math.round(secPerJob * (bulkRun.total - bulkRun.done)) : null;
        const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        return (
          <div className="sticky top-2 z-30 rounded-xl border border-blue-300 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-gray-900">
                Running {bulkRun.stage} · {bulkRun.done}/{bulkRun.total} done
                {bulkRun.failed > 0 && (
                  <span className="text-red-600"> · {bulkRun.failed} failed</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 tabular-nums">
                  {pct}% · {fmt(elapsedSec)} elapsed
                  {etaSec != null && etaSec > 0 ? ` · ~${fmt(etaSec)} left` : ""}
                </span>
                <button
                  type="button"
                  onClick={stopBulkRun}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                  Stop
                </button>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              Jobs run one at a time — you can leave this page; the run keeps going.
            </p>
          </div>
        );
      })()}

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
