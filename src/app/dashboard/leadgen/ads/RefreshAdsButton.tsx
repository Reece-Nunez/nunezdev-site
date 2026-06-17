"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

/**
 * On-demand "Refresh" button. POSTs to the owner-gated refresh route (same sync
 * the nightly cron runs), then refreshes the server component so the new
 * snapshot renders. Disabled state covers both the network call and the
 * subsequent re-render.
 */
export default function RefreshAdsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/dashboard/google-ads/refresh", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Refresh failed");
          return;
        }
        toast.success(
          `Synced ${data.campaignRows} campaign + ${data.keywordRows} keyword rows`,
        );
        router.refresh();
      } catch {
        toast.error("Refresh failed — check your connection");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isPending}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
    >
      <ArrowPathIcon className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Syncing…" : "Refresh"}
    </button>
  );
}
