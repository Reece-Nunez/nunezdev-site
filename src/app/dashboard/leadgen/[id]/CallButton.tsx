"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { PhoneArrowUpRightIcon } from "@heroicons/react/24/outline";
import { callLead } from "../actions";

interface Props {
  businessId: number;
  hasPhone: boolean;
}

/**
 * Click-to-call: kicks off a bridged call. Twilio rings the operator's own
 * phone first; when they answer, it dials the prospect (Twilio number as caller
 * ID). They talk on their normal phone — no softphone/app needed.
 */
export default function CallButton({ businessId, hasPhone }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const r = await callLead(businessId);
      if (r.ok) {
        toast.success(
          `Calling your phone${r.ring ? ` (${r.ring})` : ""} now — answer it to connect to the lead.`,
          { duration: 8000 },
        );
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending || !hasPhone}
      title={hasPhone ? undefined : "No phone number on file for this lead"}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <PhoneArrowUpRightIcon className="w-4 h-4" />
      {isPending ? "Calling…" : "Call"}
    </button>
  );
}
