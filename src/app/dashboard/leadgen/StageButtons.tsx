"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  triggerStage,
  pollJob,
  type JobStatus,
} from "./actions";
import { availableStages, type Stage } from "./utils";
import type { BusinessStatus } from "@/lib/leadgen-db";
import {
  BeakerIcon,
  DocumentCheckIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface Props {
  businessId: number;
  status: BusinessStatus;
}

const STAGE_LABELS: Record<Stage, string> = {
  research: "Run research",
  build:    "Build proposal + mockup",
  outreach: "Generate outreach",
};

const STAGE_ICONS: Record<Stage, React.ComponentType<{ className?: string }>> = {
  research: BeakerIcon,
  build:    DocumentCheckIcon,
  outreach: PaperAirplaneIcon,
};

const STAGE_ESTIMATES: Record<Stage, string> = {
  research: "~30s",
  build:    "~1-3 min",
  outreach: "~30-60s",
};

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

// Live narration of "what the pipeline is doing right now" for the
// status line under the buttons. These are calibrated from the actual
// stage entry-points in research.py / builder.py / outreach.py — they
// don't pretend to be exact (we have no telemetry from inside Claude
// calls), but the time buckets are within ~10s of what really happens.
//
// Queued = the job row exists but the worker hasn't picked it up yet
// (rare on Fly with one worker, but possible right after a deploy).
type LiveStatus = "queued" | "running";

function stagePhase(stage: Stage, status: LiveStatus, elapsedSec: number): string {
  if (status === "queued") return "Queued, waiting for the worker…";
  switch (stage) {
    case "research":
      if (elapsedSec < 5) return "Fetching the business's website…";
      return "Asking Claude to analyze the site…";
    case "build":
      if (elapsedSec < 35) return "Drafting proposal text with Claude…";
      if (elapsedSec < 110) return "Generating website mockup HTML…";
      return "Rendering PDF + uploading to S3…";
    case "outreach":
      if (elapsedSec < 20) return "Drafting personalised email…";
      if (elapsedSec < 40) return "Drafting SMS message…";
      return "Drafting phone script…";
  }
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// What the active job looks like from the client's perspective. We
// only track it while non-terminal — once a job completes or fails,
// we report via toast and clear this state.
interface ActiveJob {
  stage: Stage;
  status: LiveStatus;
  startedAt: string | null;  // server's started_at; null while queued
}

export default function StageButtons({ businessId, status }: Props) {
  const router = useRouter();
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const pollIdRef = useRef<number>(0);

  // Per-second tick to re-render the elapsed timer + phase text. We
  // only run it while there's an active job — no perpetual setState
  // when the operator is just looking at the page.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (activeJob == null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeJob]);

  // Cancel any in-flight poll on unmount so we don't setState on a
  // dead component (the job keeps running server-side; we just stop
  // polling).
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

  const stages = availableStages(status);

  function reportTerminal(job: JobStatus) {
    if (job.status === "completed") {
      toast.success(`${job.stage} completed`);
      router.refresh();
      return;
    }
    toast.error(
      () => (
        <div className="text-sm">
          <div className="font-medium">{job.stage} failed</div>
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

  async function startPolling(jobId: string, stage: Stage) {
    const myPollId = ++pollIdRef.current;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (pollIdRef.current === myPollId) {
      if (Date.now() > deadline) {
        toast.error(`${stage} is still running — check back in a minute.`);
        setActiveJob(null);
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (pollIdRef.current !== myPollId) return;

      const job = await pollJob(jobId);
      if (job == null) continue; // transient — keep polling

      if (job.status === "completed" || job.status === "failed") {
        reportTerminal(job);
        setActiveJob(null);
        return;
      }
      // Refresh activeJob with the latest status + startedAt so the
      // narration knows we've moved from queued -> running.
      setActiveJob({
        stage,
        status: job.status,
        startedAt: job.startedAt,
      });
    }
  }

  function handleClick(stage: Stage) {
    // Optimistically show "queued" before we even hear back from the
    // POST — feels faster, and the initial server response is usually
    // queued anyway.
    setActiveJob({ stage, status: "queued", startedAt: null });

    void (async () => {
      const result = await triggerStage(stage, businessId);
      if (!result.ok) {
        toast.error(result.message);
        setActiveJob(null);
        return;
      }
      // Tiny stages might already be terminal by the time the POST
      // returns. Short-circuit instead of starting the poll loop.
      if (result.status === "completed" || result.status === "failed") {
        const final = result.jobId ? await pollJob(result.jobId) : null;
        if (final) reportTerminal(final);
        else toast.success(`${stage} enqueued`);
        setActiveJob(null);
        return;
      }
      if (result.jobId) {
        await startPolling(result.jobId, stage);
      } else {
        setActiveJob(null);
      }
    })();
  }

  const isRunningAnything = activeJob !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {stages.map((stage) => {
          const Icon = STAGE_ICONS[stage];
          const isThisStageRunning = activeJob?.stage === stage;
          const disabled = isRunningAnything;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => handleClick(stage)}
              disabled={disabled}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition
                ${isThisStageRunning
                  ? "bg-gray-900 text-white border-gray-900"
                  : disabled
                  ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"}`}
            >
              {isThisStageRunning ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span>
                {STAGE_LABELS[stage]}
                <span className={`ml-1.5 text-xs ${isThisStageRunning ? "text-gray-300" : "text-gray-500"}`}>
                  {isThisStageRunning && activeJob?.startedAt
                    ? formatElapsed(elapsedSec)
                    : STAGE_ESTIMATES[stage]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Live narration of what the pipeline is doing right now. The
          text under the spinner is calibrated from research.py /
          builder.py / outreach.py — not exact, but indicative. */}
      {activeJob && (
        <div className="flex items-center gap-2 text-xs text-gray-600 tabular-nums">
          <ArrowPathIcon className="w-3 h-3 animate-spin opacity-70" />
          <span className="text-gray-700">
            {stagePhase(activeJob.stage, activeJob.status, elapsedSec)}
          </span>
          {activeJob.startedAt && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-gray-500">{formatElapsed(elapsedSec)} elapsed</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
