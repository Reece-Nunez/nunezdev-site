"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  runResearch,
  runBuild,
  runOutreach,
  type ActionResult,
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

export default function StageButtons({ businessId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [runningStage, setRunningStage] = useState<Stage | null>(null);

  const stages = availableStages(status);

  // Per master CLAUDE.md UI Feedback Rules: user feedback goes through
  // react-hot-toast (mounted via <Toaster /> in dashboard-client.tsx).
  // No inline banners, no alert/confirm.
  function reportResult(result: ActionResult) {
    if (result.ok) {
      toast.success(result.message);
      return;
    }
    // Error path: stderr from the python subprocess is the most useful
    // debugging signal — surface it inline, but trim so the toast doesn't
    // dominate the screen. Full output is still in the server logs.
    toast.error(
      () => (
        <div className="text-sm">
          <div className="font-medium">{result.message}</div>
          {result.stderr && (
            <pre className="mt-1 text-xs whitespace-pre-wrap font-mono opacity-80 max-h-32 overflow-y-auto">
              {result.stderr.slice(-600)}
            </pre>
          )}
        </div>
      ),
      { duration: 10000 },
    );
  }

  function handleClick(stage: Stage) {
    setRunningStage(stage);
    startTransition(async () => {
      const result = await STAGE_FNS[stage](businessId);
      setRunningStage(null);
      reportResult(result);
      if (result.ok) router.refresh();
    });
  }

  return (
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
  );
}
