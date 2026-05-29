"use client";

import { useState } from "react";
import { ChevronRightIcon, MapPinIcon } from "@heroicons/react/24/outline";
import type { BusinessSummary } from "@/lib/leadgen-db";
import BusinessesTable from "./BusinessesTable";

export interface CityGroup {
  city: string;
  state: string | null;
  businesses: BusinessSummary[];
}

export default function CitiesAccordion({ groups }: { groups: CityGroup[] }) {
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
                <BusinessesTable businesses={g.businesses} flat />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function keyFor(g: CityGroup): string {
  return `${g.city}|${g.state ?? ""}`;
}
