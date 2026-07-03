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
import type { BusinessStatus, BusinessSummary, Stage, StatusReason, SmsConsentBasis } from "@/lib/leadgen-db";
import type { BadgeTone } from "@/components/ui/Badge";

// Re-export Stage so existing callers (./StageButtons, ./actions) keep
// working — the canonical definition lives in leadgen-db.ts next to the
// other schema-shaped types.
export type { Stage };

// Which channel(s) a bulk send targets. Lives here (not actions.ts) so the
// client ProspectsExplorer can import the type without pulling a value export
// out of the "use server" module — same reason Stage lives here.
export type OutreachChannel = "email" | "sms" | "both";

// Business pipeline status → shared Badge tone + display label. Single source
// of truth so the index table, city accordion, and detail page render the
// same chip instead of each re-declaring a status-color map.
export const BUSINESS_STATUS_TONE: Record<BusinessStatus, BadgeTone> = {
  new: "info",
  researched: "purple",
  proposal_built: "success",
  contacted: "neutral",
  replied: "warning",
  converted: "success",
  not_interested: "danger",
};

export const BUSINESS_STATUS_LABEL: Record<BusinessStatus, string> = {
  new: "New",
  researched: "Researched",
  proposal_built: "Proposal built",
  contacted: "Contacted",
  replied: "Replied",
  converted: "Converted",
  not_interested: "Not interested",
};

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
    // A replied lead is hot — keep every stage available so the operator can
    // rebuild the proposal or regenerate outreach while the conversation's warm.
    case "replied":        return ["research", "build", "outreach"];
    // A converted lead has been handed to the CRM — the outreach funnel is
    // done, so no pipeline stages run.
    case "converted":      return [];
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

/**
 * SMS consent bases for the dropdown, in order. Values mirror
 * sms_compliance.CONSENT_BASES; labels are operator-facing. This is the
 * lawful basis the operator attests to before the lead can be texted.
 */
export const SMS_CONSENT_BASES: { value: SmsConsentBasis; label: string }[] = [
  { value: "replied_email",     label: "Replied to our email" },
  { value: "opted_in_form",     label: "Opted in via a form" },
  { value: "verbal_call",       label: "Agreed on a call" },
  { value: "existing_customer", label: "Existing customer" },
  { value: "other",             label: "Other (add a note)" },
];

/** Human-readable label for a stored SMS consent basis. */
export function smsConsentLabel(basis: SmsConsentBasis | null | undefined): string {
  if (!basis) return "";
  return SMS_CONSENT_BASES.find((b) => b.value === basis)?.label ?? basis;
}

// ── Prospects explorer: filter + sort (pure, unit-tested) ────────────

export type ProspectSort =
  | "ai_desc"
  | "ai_asc"
  | "reviews_desc"
  | "rating_desc"
  | "name";

export const PROSPECT_SORTS: { value: ProspectSort; label: string }[] = [
  { value: "ai_desc",      label: "AI score: high → low" },
  { value: "ai_asc",       label: "AI score: low → high" },
  { value: "reviews_desc", label: "Most reviews" },
  { value: "rating_desc",  label: "Highest rating" },
  { value: "name",         label: "Name (A–Z)" },
];

// Statuses that mean outreach has already gone out (or the lead has since
// moved past it). Used by the "not yet contacted" filter so a bulk send
// doesn't double-message anyone already in the conversation.
export const CONTACTED_STATUSES: ReadonlySet<BusinessStatus> = new Set<BusinessStatus>([
  "contacted",
  "replied",
  "converted",
]);

export interface ProspectFilters {
  search?: string;
  email?: "all" | "has" | "none";
  website?: "all" | "has" | "none";
  // Phone line type (Twilio Lookup, stored on the business). "mobile" keeps
  // only confirmed mobile numbers; "not_mobile" keeps everything else,
  // including landline/voip AND not-yet-looked-up (null) numbers.
  mobile?: "all" | "mobile" | "not_mobile";
  // Outreach state. "no" = not yet contacted (hasn't been sent outreach, so
  // it's a fresh send target); "yes" = already contacted/replied/converted.
  contacted?: "all" | "no" | "yes";
  city?: string; // "all" or an exact city name
  sort?: ProspectSort;
}

/**
 * Filter + sort the prospect list for the dashboard explorer. Pure so it's
 * unit-testable and reusable. Search is case-insensitive across name, category,
 * address, email, phone, and city. AI-score sorts push un-scored leads to the
 * bottom either way (ascending uses +Infinity so "no score" never ranks first).
 */
export function filterSortProspects(
  rows: BusinessSummary[],
  f: ProspectFilters = {},
): BusinessSummary[] {
  const needle = (f.search ?? "").trim().toLowerCase();
  const email = f.email ?? "all";
  const website = f.website ?? "all";
  const mobile = f.mobile ?? "all";
  const contacted = f.contacted ?? "all";
  const city = f.city ?? "all";
  const sort = f.sort ?? "ai_desc";

  const filtered = rows.filter((b) => {
    if (email === "has" && !b.email) return false;
    if (email === "none" && b.email) return false;
    if (website === "has" && !b.website) return false;
    if (website === "none" && b.website) return false;
    if (mobile === "mobile" && b.phone_type !== "mobile") return false;
    if (mobile === "not_mobile" && b.phone_type === "mobile") return false;
    if (contacted === "no" && CONTACTED_STATUSES.has(b.status)) return false;
    if (contacted === "yes" && !CONTACTED_STATUSES.has(b.status)) return false;
    if (city !== "all" && (b.city ?? "") !== city) return false;
    if (needle) {
      const hay = [b.name, b.category, b.address, b.email, b.phone, b.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (sort) {
      case "ai_asc":
        return (a.ai_score ?? Infinity) - (b.ai_score ?? Infinity);
      case "reviews_desc":
        return (b.review_count ?? -1) - (a.review_count ?? -1);
      case "rating_desc":
        return (b.rating ?? -1) - (a.rating ?? -1);
      case "name":
        return a.name.localeCompare(b.name);
      case "ai_desc":
      default:
        return (b.ai_score ?? -1) - (a.ai_score ?? -1);
    }
  });
}

/**
 * Phone-call outcomes for the Log Call dropdown, in order. Mirrors
 * _CALL_OUTCOMES on the pipeline side. Lives here (not leadgen-api) so the
 * client LogCallButton can import it without pulling in a server-only module.
 */
export const CALL_OUTCOMES: { value: string; label: string }[] = [
  { value: "no_answer", label: "No answer" },
  { value: "left_voicemail", label: "Left voicemail" },
  { value: "spoke", label: "Spoke with them" },
  { value: "interested", label: "Interested" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "do_not_call", label: "Asked not to call" },
];
