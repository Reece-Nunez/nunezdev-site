"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  runResearch,
  runBuild,
  runOutreach,
  type ActionResult,
  type Stage,
} from "./actions";
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

const STAGE_FNS: Record<Stage, (id: number) => Promise<ActionResult>> = {
  research: runResearch,
  build:    runBuild,
  outreach: runOutreach,
};

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

/**
 * Returns which stages are runnable from the current business status.
 * The pipeline progresses new -> researched -> proposal_built -> contacted,
 * but we let the user re-run any earlier stage from any state — handy if
 * the upstream input changed (e.g. they edited the website URL by hand)
 * or the AI output looked wrong.
 */
function availableStages(status: BusinessStatus): Stage[] {
  switch (status) {
    case "new":            return ["research"];
    case "researched":     return ["research", "build"];
    case "proposal_built": return ["research", "build", "outreach"];
    case "contacted":      return ["research", "build", "outreach"];
  }
}

export default function StageButtons({ businessId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [runningStage, setRunningStage] = useState<Stage | null>(null);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);

  const stages = availableStages(status);

  function handleClick(stage: Stage) {
    setRunningStage(stage);
    setLastResult(null);
    startTransition(async () => {
      const result = await STAGE_FNS[stage](businessId);
      setRunningStage(null);
      setLastResult(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {stages.map((stage) => {
          const Icon = STAGE_ICONS[stage];
          const isRunning = runningStage === stage;
          const disabled = isPending;
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

      {lastResult && (
        <div
          className={`rounded-lg border p-3 text-sm ${lastResult.ok
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-red-50 border-red-200 text-red-900"}`}
        >
          <div className="font-medium">{lastResult.message}</div>
          {lastResult.stderr && (
            <pre className="mt-2 text-xs whitespace-pre-wrap font-mono opacity-80 max-h-32 overflow-y-auto">
              {lastResult.stderr}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
