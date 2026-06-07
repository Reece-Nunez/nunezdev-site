// Pure render helper for a sortable table of business summary rows.
// No "use client" / "use server" directive — works in both contexts
// because it uses no hooks and no server-only APIs. Lets the
// server-component page.tsx AND the client-component CitiesAccordion
// share the same table layout.
import Link from "next/link";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import type { BusinessStatus, BusinessSummary } from "@/lib/leadgen-db";
import { aiScoreClass } from "./utils";

const STATUS_STYLES: Record<BusinessStatus, string> = {
  new:             "bg-blue-50 text-blue-700 border-blue-200",
  researched:      "bg-purple-50 text-purple-700 border-purple-200",
  proposal_built:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  contacted:       "bg-gray-100 text-gray-700 border-gray-200",
  replied:         "bg-orange-50 text-orange-700 border-orange-200",
  converted:       "bg-green-100 text-green-800 border-green-300",
  not_interested:  "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<BusinessStatus, string> = {
  new:             "New",
  researched:      "Researched",
  proposal_built:  "Proposal built",
  contacted:       "Contacted",
  replied:         "Replied",
  converted:       "Converted",
  not_interested:  "Not interested",
};

export default function BusinessesTable({
  businesses,
  // When the table sits inside a card (city accordion), we don't want
  // it to draw its own border + rounded corners — the parent card
  // already provides those. Default flat=false preserves the original
  // standalone look on the index page.
  flat = false,
  // Optional multi-select. When selectedIds + onToggleRow are provided, a
  // leading checkbox column appears. onToggleAll drives the header checkbox.
  selectedIds,
  onToggleRow,
  onToggleAll,
}: {
  businesses: BusinessSummary[];
  flat?: boolean;
  selectedIds?: Set<number>;
  onToggleRow?: (id: number) => void;
  onToggleAll?: (ids: number[], select: boolean) => void;
}) {
  const selectable = !!selectedIds && !!onToggleRow;
  const ids = businesses.map((b) => b.id);
  const allSelected = selectable && ids.length > 0 && ids.every((id) => selectedIds!.has(id));

  return (
    <div className={flat ? "overflow-hidden" : "rounded-xl border bg-white overflow-hidden"}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all in this group"
                    checked={allSelected}
                    onChange={(e) => onToggleAll?.(ids, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </th>
              )}
              <th className="text-left px-4 py-2.5 font-medium">Business</th>
              <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Category</th>
              <th className="text-center px-3 py-2.5 font-medium w-20">AI</th>
              <th className="text-center px-3 py-2.5 font-medium w-20 hidden sm:table-cell">Reviews</th>
              <th className="text-center px-3 py-2.5 font-medium">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {businesses.map((b) => (
              <tr key={b.id} className={`hover:bg-gray-50 ${selectable && selectedIds!.has(b.id) ? "bg-blue-50/40" : ""}`}>
                {selectable && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${b.name}`}
                      checked={selectedIds!.has(b.id)}
                      onChange={() => onToggleRow!(b.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/leadgen/${b.id}`}
                    className="font-medium text-gray-900 hover:text-blue-700"
                  >
                    {b.name}
                  </Link>
                  {b.address && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate max-w-md">
                      {b.address}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                  {b.category ?? "—"}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex items-center justify-center w-12 px-2 py-1 rounded-full text-xs font-semibold border tabular-nums ${aiScoreClass(
                      b.ai_score
                    )}`}
                  >
                    {b.ai_score != null ? `${b.ai_score}/10` : "—"}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-gray-600 tabular-nums hidden sm:table-cell">
                  {b.review_count != null ? (
                    <>
                      {b.rating != null && (
                        <span className="text-gray-900">{b.rating}★</span>
                      )}
                      <span className="text-gray-500"> · {b.review_count}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${STATUS_STYLES[b.status]}`}
                  >
                    {STATUS_LABELS[b.status]}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={`/dashboard/leadgen/${b.id}`}
                    className="text-gray-400 hover:text-gray-700"
                    aria-label={`Open ${b.name}`}
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
