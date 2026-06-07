"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  PaperAirplaneIcon,
  ClockIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { sendFollowUp, skipFollowUp, snoozeFollowUp } from "../actions";

interface Props {
  followUpId: number;
  /** Disable Send when the business has no email on file. */
  canSend: boolean;
}

/**
 * Per-row actions for the follow-up queue: Send (Resend), Snooze 7d, Skip.
 * All three go through server actions that enforce owner auth + revalidate the
 * queue, so the row drops off the list after a successful action.
 */
export default function FollowUpActions({ followUpId, canSend }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(r.message ?? "Something went wrong");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending || !canSend}
        title={canSend ? undefined : "No email on file for this lead"}
        onClick={() => run(() => sendFollowUp(followUpId), "Follow-up sent")}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PaperAirplaneIcon className="w-3.5 h-3.5" />
        {isPending ? "Working…" : "Send"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => snoozeFollowUp(followUpId, 7), "Snoozed 7 days")}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        <ClockIcon className="w-3.5 h-3.5" />
        Snooze 7d
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => skipFollowUp(followUpId), "Skipped")}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        <XMarkIcon className="w-3.5 h-3.5" />
        Skip
      </button>
    </div>
  );
}
