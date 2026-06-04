"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { NoSymbolIcon, ArrowPathIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { markNotInterested, reopenLead } from "../actions";
import { NOT_INTERESTED_REASONS } from "../utils";
import type { BusinessStatus, StatusReason } from "@/lib/leadgen-api";

interface Props {
  businessId: number;
  status: BusinessStatus;
  /** Status to reopen into — the value the lead held before being declined. */
  priorStatus: BusinessStatus;
}

/**
 * Mark a lead "Not interested" (with a reason + optional note) or reopen a
 * previously declined lead. Distinct from the toast-confirm pattern used by
 * SendEmailButton because capturing a reason + note needs a small form —
 * we expand an inline panel rather than cram fields into a toast.
 *
 * The reason vocabulary, the audit log, and the send-suppression all live on
 * the pipeline side (see statuses.py); this is the operator's entry point.
 */
export default function NotInterestedButton({ businessId, status, priorStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<StatusReason>(NOT_INTERESTED_REASONS[0].value);
  const [note, setNote] = useState("");

  function submit() {
    startTransition(async () => {
      const result = await markNotInterested(businessId, reason, note);
      if (result.ok) {
        toast.success("Marked not interested");
        setOpen(false);
        setNote("");
      } else {
        toast.error(result.message);
      }
    });
  }

  function reopen() {
    startTransition(async () => {
      const result = await reopenLead(businessId, priorStatus);
      if (result.ok) {
        toast.success("Lead reopened");
      } else {
        toast.error(result.message);
      }
    });
  }

  // Already declined → offer to reopen instead.
  if (status === "not_interested") {
    return (
      <button
        type="button"
        onClick={reopen}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <ArrowPathIcon className="w-3.5 h-3.5" />
        {isPending ? "Reopening..." : "Reopen lead"}
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-red-700 border border-red-200 bg-red-50 hover:bg-red-100"
      >
        <NoSymbolIcon className="w-3.5 h-3.5" />
        Mark not interested
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-3">
      <div className="text-sm font-medium text-gray-900">Why are they not interested?</div>
      <div className="space-y-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as StatusReason)}
            disabled={isPending}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            {NOT_INTERESTED_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
            rows={2}
            placeholder="Anything worth remembering for next time…"
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-red-600 text-white border border-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <CheckIcon className="w-3.5 h-3.5" />
          {isPending ? "Saving..." : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
