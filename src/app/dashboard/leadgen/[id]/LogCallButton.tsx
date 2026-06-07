"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PhoneIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { logCall } from "../actions";
import { CALL_OUTCOMES } from "@/lib/leadgen-api";

interface Props {
  businessId: number;
}

/**
 * Log the outcome of a phone call. Collapsed to a button; expands to an
 * outcome dropdown + optional note. "Interested" warms the lead to 'replied'
 * (handled server-side); everything else just lands in the timeline.
 */
export default function LogCallButton({ businessId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState(CALL_OUTCOMES[0].value);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const r = await logCall(businessId, outcome, note);
      if (r.ok) {
        toast.success("Call logged");
        setOpen(false);
        setNote("");
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-800 border border-gray-300 bg-white hover:bg-gray-50"
      >
        <PhoneIcon className="w-4 h-4" />
        Log call
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2">
      <div className="text-sm font-medium text-gray-900">Log a call</div>
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        disabled={isPending}
        className="block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
      >
        {CALL_OUTCOMES.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={isPending}
        placeholder="Note (optional, e.g. call back Tuesday)"
        className="block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-gray-900 text-white border border-gray-900 hover:bg-gray-800 disabled:opacity-60"
        >
          <CheckIcon className="w-3.5 h-3.5" />
          {isPending ? "Saving…" : "Save"}
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
