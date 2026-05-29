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

// Poll cadence in milliseconds. Jobs commonly finish in 10-60s so 2.5s
// gives the operator near-immediate feedback without hammering the API.
// Each poll is one Postgres SELECT + one auth check — cheap.
const POLL_INTERVAL_MS = 2500;

// Belt + braces: if a job is still queued/running after this much
// wall-clock time, we give up polling and surface "still running, check
// back later" rather than spinning forever. The pipeline's longest
// stage (build) tops out around 3 min — 8 minutes covers a slow Claude
// streak comfortably.
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

export default function StageButtons({ businessId, status }: Props) {
  const router = useRouter();

  // `running` is keyed by stage so the spinner shows on the specific
  // button the operator clicked; null = nothing in flight.
  const [running, setRunning] = useState<Stage | null>(null);
  // Track active poll so an in-progress unmount + setState calls don't
  // try to update a dead component.
  const pollIdRef = useRef<number>(0);

  // Clean up any running poll on unmount — important when navigating
  // away mid-job (the job continues server-side; we just stop polling).
  useEffect(() => {
    return () => {
      pollIdRef.current = -1;
    };
  }, []);

  const stages = availableStages(status);

  function reportTerminal(job: JobStatus) {
    if (job.status === "completed") {
      toast.success(`${job.stage} completed`);
      router.refresh();
      return;
    }
    // failed
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

    // Initial setRunning happens in handleClick before we get here so
    // the button shows the spinner immediately, not after the first
    // poll lands.
    while (pollIdRef.current === myPollId) {
      if (Date.now() > deadline) {
        toast.error(`${stage} is still running — check back in a minute.`);
        setRunning(null);
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      // Component may have unmounted (or operator clicked again) during
      // the sleep — bail out if so.
      if (pollIdRef.current !== myPollId) return;

      const job = await pollJob(jobId);
      if (job == null) continue; // transient — keep polling
      if (job.status === "completed" || job.status === "failed") {
        reportTerminal(job);
        setRunning(null);
        return;
      }
      // queued or running — loop
    }
  }

  function handleClick(stage: Stage) {
    setRunning(stage);
    void (async () => {
      const result = await triggerStage(stage, businessId);
      if (!result.ok) {
        toast.error(result.message);
        setRunning(null);
        return;
      }
      // result.status is the snapshot at trigger time; if the worker
      // already finished by the time we get here (rare but possible
      // for tiny stages), short-circuit and skip polling.
      if (result.status === "completed" || result.status === "failed") {
        const final = result.jobId ? await pollJob(result.jobId) : null;
        if (final) reportTerminal(final);
        else toast.success(`${stage} enqueued`);
        setRunning(null);
        return;
      }
      if (result.jobId) {
        await startPolling(result.jobId, stage);
      } else {
        // Defensive: shouldn't happen because ok=true implies a job
        // exists, but the type allows it.
        setRunning(null);
      }
    })();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((stage) => {
        const Icon = STAGE_ICONS[stage];
        const isRunning = running === stage;
        const disabled = running !== null;
        return (
          <button
            key={stage}
            type="button"
            onClick={() => handleClick(stage)}
            disabled={disabled}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition
              ${isRunning
                ? "bg-gray-900 text-white border-gray-900"
                : disabled
                ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"}`}
          >
            {isRunning ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <Icon className="w-4 h-4" />
            )}
            <span>
              {STAGE_LABELS[stage]}
              <span className={`ml-1.5 text-xs ${isRunning ? "text-gray-300" : "text-gray-500"}`}>
                {STAGE_ESTIMATES[stage]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
