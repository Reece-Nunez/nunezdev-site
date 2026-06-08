"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ChevronRightIcon,
  MapPinIcon,
  BeakerIcon,
  DocumentCheckIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { BusinessSummary } from "@/lib/leadgen-db";
import BusinessesTable from "./BusinessesTable";
import { bulkRunStage } from "./actions";
import type { Stage } from "./utils";

export interface CityGroup {
  city: string;
  state: string | null;
  businesses: BusinessSummary[];
}

export default function CitiesAccordion({ groups }: { groups: CityGroup[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: number[], select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function runBulk(stage: Stage) {
    const ids = [...selected];
    startTransition(async () => {
      const r = await bulkRunStage(stage, ids);
      if (r.ok) {
        toast.success(
          `Enqueued ${stage} for ${r.enqueued} lead${r.enqueued === 1 ? "" : "s"}` +
            (r.failed ? ` (${r.failed} failed)` : ""),
        );
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }
  // Default-expand the first (largest) city so the operator sees
  // a real list on load rather than a wall of closed accordions.
  // Subsequent toggles are sticky for the session.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (groups.length === 0) return new Set();
    return new Set([keyFor(groups[0])]);
  });

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(groups.map(keyFor)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
        No businesses match this filter.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Bulk action bar ──────────────────────────────────────────
          Sticks to the top while leads are selected so it's reachable without
          scrolling. Fans out the chosen stage as independent jobs (see
          bulkRunStage). */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-gray-900">
            {selected.size} selected
          </span>
          <span className="text-gray-300">·</span>
          <BulkButton onClick={() => runBulk("research")} disabled={isPending} icon={BeakerIcon}>
            Research
          </BulkButton>
          <BulkButton onClick={() => runBulk("build")} disabled={isPending} icon={DocumentCheckIcon}>
            Build
          </BulkButton>
          <BulkButton onClick={() => runBulk("outreach")} disabled={isPending} icon={PaperAirplaneIcon}>
            Outreach
          </BulkButton>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={isPending}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            <XMarkIcon className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {groups.length > 1 && (
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
          >
            Expand all
          </button>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
          >
            Collapse all
          </button>
        </div>
      )}

      {groups.map((g) => {
        const key = keyFor(g);
        const isOpen = expanded.has(key);
        return (
          <div
            key={key}
            className="rounded-xl border bg-white overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRightIcon
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
                <MapPinIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="font-semibold text-gray-900 truncate">{g.city}</span>
                {g.state && (
                  <span className="text-sm text-gray-500 flex-shrink-0">
                    · {g.state}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-500 tabular-nums flex-shrink-0">
                {g.businesses.length}{" "}
                <span className="text-gray-400">
                  {g.businesses.length === 1 ? "lead" : "leads"}
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="border-t">
                <BusinessesTable
                  businesses={g.businesses}
                  flat
                  selectedIds={selected}
                  onToggleRow={toggleRow}
                  onToggleAll={toggleAll}
                />
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}

function BulkButton({
  onClick,
  disabled,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function keyFor(g: CityGroup): string {
  return `${g.city}|${g.state ?? ""}`;
}
