"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import {
  BeakerIcon,
  DocumentCheckIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { BusinessSummary } from "@/lib/leadgen-db";
import BusinessesTable from "./BusinessesTable";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { bulkRunStage } from "./actions";
import { useBulkRun } from "../BulkRunProvider";
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

/**
 * Filter / sort / search over the prospect list, with multi-select bulk
 * actions. Operates client-side on the already-fetched list (status is applied
 * server-side via the chips above this). Filtering + sorting lives in the pure,
 * tested filterSortProspects helper.
 */
export default function ProspectsExplorer({ businesses }: { businesses: BusinessSummary[] }) {
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

  // Bulk-run state + progress bar live in the dashboard layout (BulkRunProvider)
  // so a run keeps showing while the operator navigates to a detail page or
  // elsewhere. This component just kicks runs off.
  const { startBulkRun } = useBulkRun();

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
      // Hand off to the layout-level progress bar — it polls until every job is
      // terminal, then refreshes the list. Survives navigation away from here.
      startBulkRun({
        stage,
        total: r.jobIds.length,
        jobIds: r.jobIds,
        done: 0,
        failed: 0,
        startedAt: Date.now(),
      });
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
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, category, email, city…"
          className="flex-1 min-w-[200px]"
        />

        <FilterSelect value={email} onChange={(v) => setEmail(v as TriState)} aria-label="Email filter">
          <option value="all">Email: any</option>
          <option value="has">Has email</option>
          <option value="none">No email</option>
        </FilterSelect>

        <FilterSelect value={website} onChange={(v) => setWebsite(v as TriState)} aria-label="Website filter">
          <option value="all">Website: any</option>
          <option value="has">Has website</option>
          <option value="none">No website</option>
        </FilterSelect>

        <FilterSelect value={mobile} onChange={(v) => setMobile(v as MobileFilter)} aria-label="Phone type filter">
          <option value="all">Phone: any</option>
          <option value="mobile">Mobile only</option>
          <option value="not_mobile">Not mobile</option>
        </FilterSelect>

        {cities.length > 1 && (
          <FilterSelect value={city} onChange={setCity} aria-label="City filter">
            <option value="all">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </FilterSelect>
        )}

        <FilterSelect value={sort} onChange={(v) => setSort(v as ProspectSort)} aria-label="Sort">
          {PROSPECT_SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </FilterSelect>
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

      {/* Bulk-run progress bar renders from BulkRunProvider (dashboard layout)
          so it stays visible while navigating away from this page. */}

      {/* ── Bulk action bar (sticky top while leads are selected) ──── */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-gray-900">{selected.size} selected</span>
          <span className="text-gray-300">·</span>
          <Button variant="secondary" onClick={() => runBulk("research")} disabled={isPending} leftIcon={<BeakerIcon className="w-4 h-4" />}>Research</Button>
          <Button variant="secondary" onClick={() => runBulk("build")} disabled={isPending} leftIcon={<DocumentCheckIcon className="w-4 h-4" />}>Build</Button>
          <Button variant="secondary" onClick={() => runBulk("outreach")} disabled={isPending} leftIcon={<PaperAirplaneIcon className="w-4 h-4" />}>Outreach</Button>
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

