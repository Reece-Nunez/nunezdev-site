"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  triggerProspect,
  pollJob,
  type JobStatus,
} from "./actions";
import {
  ArrowPathIcon,
  MapPinIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const POLL_INTERVAL_MS = 3000;
// Prospect typically takes 30-90s. We give it 10 minutes because the
// Google Places API rate-limits + occasional 5xx retries can extend
// the tail.
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

type LiveStatus = "queued" | "running";

interface ActiveJob {
  status: LiveStatus;
  startedAt: string | null;
  zip: string;
}

function prospectPhase(elapsedSec: number): string {
  // Calibrated from prospect.py: ~20 Google Places categories scanned
  // in order. The phase strings here are rough — telemetry would let
  // us name the current category exactly, but we don't have that
  // wired yet (M2 only persists job state, not progress).
  if (elapsedSec < 5) return "Geocoding zip + warming up Google Places…";
  if (elapsedSec < 30) return "Scanning local categories (1/3)…";
  if (elapsedSec < 70) return "Scanning service categories (2/3)…";
  if (elapsedSec < 120) return "Scanning retail + dining (3/3)…";
  return "Writing results to the database…";
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ProspectCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [zip, setZip] = useState("");
  const [max, setMax] = useState(20);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const pollIdRef = useRef<number>(0);

  // Keep the form open while a job is in flight even if the operator
  // clicks the close button — the live status panel lives inside.
  // Once terminal, we leave it open so the toast + form input
  // re-flow naturally and the operator can run another zip without
  // re-clicking.
  const showForm = open || activeJob !== null;

  const [, setTick] = useState(0);
  useEffect(() => {
    if (activeJob == null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeJob]);

  useEffect(() => {
    return () => {
      pollIdRef.current = -1;
    };
  }, []);

  const elapsedSec = activeJob?.startedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(activeJob.startedAt).getTime()) / 1000),
      )
    : 0;

  function reportTerminal(job: JobStatus, zip: string) {
    if (job.status === "completed") {
      const added = (job.result?.new_businesses as number | undefined) ?? 0;
      if (added === 0) {
        toast(`No new businesses found for ${zip} — they may all be duplicates of existing rows.`, {
          icon: "ℹ️",
        });
      } else {
        toast.success(`${added} new businesses added from zip ${zip}`);
      }
      router.refresh();
      return;
    }
    toast.error(
      () => (
        <div className="text-sm">
          <div className="font-medium">prospect failed</div>
          {job.error && (
            <pre className="mt-1 text-xs whitespace-pre-wrap font-mono opacity-80 max-h-32 overflow-y-auto">
              {job.error.slice(-600)}
            </pre>
          )}
        </div>
      ),
      { duration: 12000 },
    );
  }

  async function startPolling(jobId: string, zipForToast: string) {
    const myPollId = ++pollIdRef.current;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (pollIdRef.current === myPollId) {
      if (Date.now() > deadline) {
        toast.error("prospect is still running — check back in a minute.");
        setActiveJob(null);
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (pollIdRef.current !== myPollId) return;

      const job = await pollJob(jobId);
      if (job == null) continue;
      if (job.status === "completed" || job.status === "failed") {
        reportTerminal(job, zipForToast);
        setActiveJob(null);
        return;
      }
      setActiveJob({
        status: job.status,
        startedAt: job.startedAt,
        zip: zipForToast,
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeJob !== null) return;
    if (!/^\d{5}$/.test(zip)) {
      toast.error("Enter a 5-digit US zip code");
      return;
    }
    if (max < 1 || max > 50) {
      toast.error("Max per category must be between 1 and 50");
      return;
    }
    const submittedZip = zip;
    setActiveJob({ status: "queued", startedAt: null, zip: submittedZip });
    void (async () => {
      const result = await triggerProspect(submittedZip, max);
      if (!result.ok) {
        toast.error(result.message);
        setActiveJob(null);
        return;
      }
      if (result.jobId) {
        await startPolling(result.jobId, submittedZip);
      } else {
        setActiveJob(null);
      }
    })();
  }

  const isRunning = activeJob !== null;

  // Collapsed state: a single button. Saves vertical space on the
  // common case where the operator is reviewing existing leads, not
  // starting a new campaign.
  if (!showForm) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border bg-white text-gray-800 border-gray-300 hover:bg-gray-50 transition"
        >
          <PlusIcon className="w-4 h-4" />
          New prospect
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-5 h-5 text-gray-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Prospect new businesses
          </h2>
        </div>
        {!isRunning && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close prospect form"
            className="text-gray-400 hover:text-gray-700 -m-1 p-1"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Search ~20 categories around a US zip code. Returns ~15-40 new
        businesses depending on density. Typical run: 30-90s.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label htmlFor="prospect-zip" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Zip code
          </label>
          <input
            id="prospect-zip"
            type="text"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            placeholder="e.g. 84601"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
            disabled={isRunning}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm w-32 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="prospect-max" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Max per category
          </label>
          <input
            id="prospect-max"
            type="number"
            min={1}
            max={50}
            value={max}
            onChange={(e) => setMax(Number(e.target.value) || 0)}
            disabled={isRunning}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm w-24 tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <button
          type="submit"
          disabled={isRunning || !zip}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition
            ${isRunning
              ? "bg-gray-900 text-white border-gray-900"
              : !zip
              ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
              : "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"}`}
        >
          {isRunning ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : (
            <MapPinIcon className="w-4 h-4" />
          )}
          {isRunning ? "Prospecting…" : "Start prospecting"}
        </button>
      </form>

      {activeJob && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 tabular-nums">
          <ArrowPathIcon className="w-3 h-3 animate-spin opacity-70" />
          <span className="text-gray-700">
            {activeJob.status === "queued"
              ? "Queued, waiting for the worker…"
              : prospectPhase(elapsedSec)}
          </span>
          {activeJob.startedAt && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-gray-500">{formatElapsed(elapsedSec)} elapsed</span>
            </>
          )}
          <span className="text-gray-300">·</span>
          <span className="text-gray-500 font-mono">zip {activeJob.zip}</span>
        </div>
      )}
    </div>
  );
}
