/**
 * Pure helpers for the leadgen dashboard. Kept free of React, server-only
 * imports, and DB access so they're testable from `node --test` without
 * a runtime.
 *
 * `Stage` lives here (not in actions.ts) because StageButtons is a client
 * component and we can't import non-async exports from a "use server"
 * module into the client. Server actions re-export `Stage` for callers
 * that already import from actions.ts.
 */
import type { BusinessStatus } from "@/lib/leadgen-db";

export type Stage = "research" | "build" | "outreach";

/**
 * Color-coded Tailwind classes for an AI opportunity score (0-10).
 *
 * The scale is deliberately non-linear at the top end: 9-10 is "high
 * conviction lead, surface red", 7-8 is "worth pursuing, surface orange".
 * Below 5 fades to muted blue/gray so the eye sorts on the high scores.
 */
export function aiScoreClass(score: number | null | undefined): string {
  if (score == null) return "bg-gray-50 text-gray-500 border-gray-200";
  if (score >= 9)    return "bg-red-50 text-red-700 border-red-200";
  if (score >= 7)    return "bg-orange-50 text-orange-700 border-orange-200";
  if (score >= 5)    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (score >= 3)    return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

/**
 * Which pipeline stages are runnable from the current business status.
 *
 * The pipeline progresses new → researched → proposal_built → contacted,
 * but we let the user re-run any earlier stage from any state — handy if
 * the upstream input changed (e.g. they edited the website URL by hand)
 * or the AI output looked wrong.
 */
export function availableStages(status: BusinessStatus): Stage[] {
  switch (status) {
    case "new":            return ["research"];
    case "researched":     return ["research", "build"];
    case "proposal_built": return ["research", "build", "outreach"];
    case "contacted":      return ["research", "build", "outreach"];
  }
}
