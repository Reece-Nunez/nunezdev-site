"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { UserPlusIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { convertToLead } from "../actions";
import type { BusinessStatus } from "@/lib/leadgen-api";

interface Props {
  businessId: number;
  status: BusinessStatus;
  hasEmail: boolean;
}

/**
 * Convert a prospect into a CRM lead. Once converted, the prospect shows a
 * link into the CRM instead of the button — the funnel hand-off is one-way.
 */
export default function ConvertToLeadButton({ businessId, status, hasEmail }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (status === "converted") {
    return (
      <Link
        href="/dashboard/leads"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:underline"
      >
        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        Converted — view in CRM
      </Link>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const r = await convertToLead(businessId);
      if (r.ok) {
        toast.success(
          r.alreadyExisted
            ? "Already in your CRM — linked and marked converted"
            : "Converted — added to your CRM leads",
        );
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending || !hasEmail}
      title={hasEmail ? undefined : "Add an email to this prospect before converting"}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-green-600 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <UserPlusIcon className="w-4 h-4" />
      {isPending ? "Converting…" : "Convert to CRM lead"}
    </button>
  );
}
