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
import type { BusinessStatus, Stage, StatusReason } from "@/lib/leadgen-db";

// Re-export Stage so existing callers (./StageButtons, ./actions) keep
// working — the canonical definition lives in leadgen-db.ts next to the
// other schema-shaped types.
export type { Stage };

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
    // A declined lead is dormant — no stages run until it's reopened.
    // This mirrors the pipeline-side send guard (outreach refuses to email
    // a not_interested business) so the UI can't offer an action the API
    // would reject.
    case "not_interested": return [];
  }
}

/**
 * Loss reasons for the "Not interested" action, in dropdown order. Values
 * mirror StatusReason / statuses.py::NOT_INTERESTED_REASONS; labels are the
 * operator-facing text. Shared by the client button and any reporting view.
 */
export const NOT_INTERESTED_REASONS: { value: StatusReason; label: string }[] = [
  { value: "too_expensive",    label: "Too expensive" },
  { value: "using_competitor", label: "Using a competitor" },
  { value: "no_budget",        label: "No budget" },
  { value: "bad_timing",       label: "Bad timing" },
  { value: "not_a_fit",        label: "Not a fit" },
  { value: "no_response",      label: "No response after follow-up" },
  { value: "do_not_contact",   label: "Do not contact" },
  { value: "other",            label: "Other" },
];

/** Human-readable label for a stored reason code (falls back to the code). */
export function reasonLabel(reason: StatusReason | null | undefined): string {
  if (!reason) return "";
  return NOT_INTERESTED_REASONS.find((r) => r.value === reason)?.label ?? reason;
}
