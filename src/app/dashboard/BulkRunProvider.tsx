"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { bulkJobProgress, cancelBulkRun, getActiveBulkRun } from "./leadgen/actions";
import type { Stage } from "./leadgen/utils";
import { evalBulkProgress } from "./bulkRunProgress";

// Live progress of an in-flight bulk run (research/build/outreach over many
// leads). Jobs drain one at a time on the pipeline's single worker, so a big
// run takes a while.
export type BulkRun = {
  stage: Stage;
  total: number;
  jobIds: string[];
  done: number;
  failed: number;
  startedAt: number;
};

type BulkRunContextValue = {
  bulkRun: BulkRun | null;
  // Start tracking a freshly-enqueued run. Caller enqueues the jobs, then hands
  // the jobIds here — the provider polls to completion and refreshes.
  startBulkRun: (run: BulkRun) => void;
  stopBulkRun: () => void;
};

const BulkRunContext = createContext<BulkRunContextValue | null>(null);

// sessionStorage so an in-flight run survives a hard page reload too (not just
// client-side navigation). Scoped to the tab, cleared when it closes.
const RUN_KEY = "leadgen:bulk-run";

/**
 * Hosts the bulk-run progress bar at the dashboard-layout level so it persists
 * across route changes — the operator can open a prospect detail page (or any
 * other dashboard page) and still watch the run finish. The jobs run server-side
 * regardless; this is the watcher that used to die when ProspectsExplorer
 * unmounted on navigation.
 */
export function BulkRunProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [bulkRun, setBulkRun] = useState<BulkRun | null>(null);
  const pollRef = useRef(0);
  // Guards the persist effect until after the one-time restore, so the initial
  // mount doesn't clobber a stored run with the null default.
  const [restored, setRestored] = useState(false);

  // Restore an in-flight run once on mount. Two sources, in order:
  //  1. sessionStorage — a run this tab already knew about (survives reload).
  //  2. the pipeline's active-jobs endpoint — a run this browser never saw
  //     (started on another tab/device, or before the bar persisted ids).
  // Each setBulkRun uses the functional guard `cur ?? next` so a run the
  // operator kicks off between mount and the async resolving is never clobbered.
  useEffect(() => {
    let cancelled = false;
    let resumedFromStorage = false;
    try {
      const raw = sessionStorage.getItem(RUN_KEY);
      if (raw) {
        const r = JSON.parse(raw) as BulkRun;
        if (r && Array.isArray(r.jobIds) && r.jobIds.length > 0) {
          setBulkRun(r);
          resumedFromStorage = true;
        }
      }
    } catch {
      // Corrupt/blocked storage — fall through to the active-jobs check.
    }
    setRestored(true);
    if (!resumedFromStorage) {
      (async () => {
        const res = await getActiveBulkRun();
        if (cancelled || !res.ok || !res.run) return;
        const run = res.run;
        // done/failed start at 0; the poll fills them in on its first tick.
        setBulkRun((cur) => cur ?? { ...run, done: 0, failed: 0 });
      })();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on change so a reload can resume. Cleared when the run ends (null).
  useEffect(() => {
    if (!restored) return;
    try {
      if (bulkRun) sessionStorage.setItem(RUN_KEY, JSON.stringify(bulkRun));
      else sessionStorage.removeItem(RUN_KEY);
    } catch {
      // Storage full/blocked — non-fatal, just won't resume on reload.
    }
  }, [restored, bulkRun]);

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
        const { done, failed, finished } = evalBulkProgress(p, bulkRun.total);
        setBulkRun((cur) => (cur ? { ...cur, done, failed } : cur));
        if (finished) {
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

  const startBulkRun = useCallback((run: BulkRun) => {
    setBulkRun(run);
  }, []);

  const stopBulkRun = useCallback(() => {
    setBulkRun((run) => {
      if (!run) return null;
      // Hide the bar + stop polling immediately (the effect cleanup bumps
      // pollRef), then cancel the pending jobs server-side so the worker skips
      // them. The job currently mid-flight finishes on its own.
      cancelBulkRun(run.jobIds).then((r) => {
        if (r.ok) {
          toast.success(
            `Stopped — cancelled ${r.cancelled} pending job${r.cancelled === 1 ? "" : "s"}`,
          );
        } else {
          toast.error(r.message);
        }
        router.refresh();
      });
      return null;
    });
  }, [router]);

  return (
    <BulkRunContext.Provider value={{ bulkRun, startBulkRun, stopBulkRun }}>
      {children}
      <BulkRunBar bulkRun={bulkRun} onStop={stopBulkRun} />
    </BulkRunContext.Provider>
  );
}

export function useBulkRun(): BulkRunContextValue {
  const ctx = useContext(BulkRunContext);
  if (!ctx) throw new Error("useBulkRun must be used within a BulkRunProvider");
  return ctx;
}

// Floating progress bar — fixed to the viewport bottom so it stays visible on
// every dashboard page, not just the prospect list.
function BulkRunBar({ bulkRun, onStop }: { bulkRun: BulkRun | null; onStop: () => void }) {
  if (!bulkRun) return null;
  const pct = bulkRun.total ? Math.round((bulkRun.done / bulkRun.total) * 100) : 0;
  const elapsedSec = Math.max(0, Math.floor((Date.now() - bulkRun.startedAt) / 1000));
  const secPerJob = bulkRun.done > 0 ? elapsedSec / bulkRun.done : 0;
  const etaSec = secPerJob > 0 ? Math.round(secPerJob * (bulkRun.total - bulkRun.done)) : null;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl rounded-xl border border-blue-300 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
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
            onClick={onStop}
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
        Jobs run one at a time — you can navigate anywhere; the run keeps going.
      </p>
    </div>
  );
}
