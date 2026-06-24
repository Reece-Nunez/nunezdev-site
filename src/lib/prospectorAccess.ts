/**
 * Single source of truth for what the restricted `prospector` role may reach.
 *
 * A prospector (Josh — helped build lead-gen) gets the leadgen / leads CRM /
 * thumbtack surface and nothing financial. This module is consumed by:
 *   - middleware.ts, as a DENY-BY-DEFAULT backstop. This is what actually keeps
 *     a prospector out of the financial API routes, several of which pre-date
 *     the role system and still accept any org_member inline (see the
 *     auth-drift note in authz.ts).
 *   - the dashboard nav (Sidebar / MobileNavigation), to show only allowed links.
 *
 * Kept pure and dependency-free so it runs in edge middleware and in unit tests.
 */

// Page sections a prospector can open.
const ALLOWED_PAGE_PREFIXES = [
  "/dashboard/leadgen",
  "/dashboard/leads",
  "/dashboard/thumbtack",
];

// API routes the leadgen / leads / thumbtack screens call.
const ALLOWED_API_PREFIXES = [
  "/api/admin/leads",
  "/api/admin/lead-sources",
  "/api/admin/import-thumbtack-leads",
  "/api/admin/cleanup-duplicate-thumbtack",
  "/api/admin/sms-outreach",
  "/api/thumbtack",
  "/api/leadgen",
];

/** Nav hrefs shown to a prospector (Sidebar + MobileNavigation). */
export const PROSPECTOR_NAV_HREFS = [
  "/dashboard/leadgen",
  "/dashboard/leadgen/ads",
  "/dashboard/leads",
  "/dashboard/thumbtack",
];

/** Where a prospector lands / is redirected when they hit a denied page. */
export const PROSPECTOR_HOME = "/dashboard/leadgen";

/**
 * Prefix match on path SEGMENTS: "/x" matches "/x" and "/x/y" but NOT "/xy".
 * This stops "/api/admin/leads" from accidentally authorizing a future
 * "/api/admin/leads-export" route.
 */
function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

export function isPathAllowedForProspector(path: string): boolean {
  // Normalize a trailing slash (but keep root "/").
  const p = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  const prefixes = p.startsWith("/api/")
    ? ALLOWED_API_PREFIXES
    : ALLOWED_PAGE_PREFIXES;
  return prefixes.some((prefix) => matchesPrefix(p, prefix));
}
