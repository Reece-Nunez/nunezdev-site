/**
 * Single source of truth for the client-report sections, the individual line
 * items in each, their honest labels, and whether each item can be verified
 * automatically (`auto`) or still requires a human (`manual`).
 *
 * This module is intentionally pure — no `fs`, `tls`, network, or other
 * server-only imports — so it is safe to import from both the server-side
 * check modules AND the client-side ReportBuilder. Keep it that way.
 *
 * Why labels live here instead of in each component: previously the builder UI
 * and the automation produced parallel arrays that had to stay index-aligned by
 * hand, and the labels claimed work the automation never did ("Tested on mobile
 * (iPhone + Android)" when all it checked was a viewport meta tag). Centralizing
 * the labels and tagging each item auto/manual keeps the report honest: an
 * `auto` item is only ever checked when something was actually measured, and a
 * `manual` item is plainly presented as human-verified.
 */

export type SectionStatus = 'healthy' | 'attention' | 'issue' | 'unknown';

export type ItemKind = 'auto' | 'manual';

/**
 * - `pass`    — verified and good (auto), or human confirmed done (manual)
 * - `fail`    — verified and NOT good (auto only); we measured a real problem
 * - `pending` — not yet verified; the default for manual items, and what an
 *               auto item falls back to when its check could not run
 */
export type ItemOutcome = 'pass' | 'fail' | 'pending';

export interface ItemDef {
  /** Stable key so automation can target an item without relying on order. */
  key: string;
  label: string;
  kind: ItemKind;
}

export type SectionKey =
  | 'siteHealth'
  | 'performance'
  | 'security'
  | 'seo'
  | 'forms'
  | 'analytics'
  | 'content'
  | 'hosting';

export interface SectionDef {
  key: SectionKey;
  title: string;
  items: ItemDef[];
}

export const SECTION_DEFS: SectionDef[] = [
  {
    key: 'siteHealth',
    title: 'Site Health & Uptime',
    items: [
      { key: 'live', label: 'Site is live and responding', kind: 'auto' },
      { key: 'viewport', label: 'Responsive viewport configured', kind: 'auto' },
      { key: 'ssl', label: 'SSL certificate valid', kind: 'auto' },
      { key: 'crossBrowser', label: 'Spot-checked key pages on desktop + mobile', kind: 'manual' },
    ],
  },
  {
    key: 'performance',
    title: 'Performance',
    items: [
      { key: 'lighthouse', label: 'Lighthouse audit run (desktop + mobile)', kind: 'auto' },
      { key: 'cwv', label: 'Core Web Vitals measured (LCP, CLS, INP)', kind: 'auto' },
      { key: 'optimize', label: 'Reviewed image/asset optimization opportunities', kind: 'manual' },
    ],
  },
  {
    key: 'security',
    title: 'Security & Dependencies',
    items: [
      { key: 'headers', label: 'HTTP security headers checked', kind: 'auto' },
      { key: 'envExposed', label: 'No publicly exposed .env file', kind: 'auto' },
      { key: 'npmAudit', label: 'Dependency vulnerabilities reviewed (npm audit)', kind: 'manual' },
      { key: 'advisories', label: 'Framework security advisories reviewed', kind: 'manual' },
      { key: 'spam', label: 'Form spam protection verified', kind: 'manual' },
    ],
  },
  {
    key: 'seo',
    title: 'SEO & Discoverability',
    items: [
      { key: 'sitemap', label: 'Sitemap accessible and valid', kind: 'auto' },
      { key: 'brokenLinks', label: 'Homepage links scanned for breakage', kind: 'auto' },
      { key: 'meta', label: 'Meta title & description present', kind: 'auto' },
      { key: 'og', label: 'Open Graph tags present', kind: 'auto' },
      { key: 'searchConsole', label: 'Search Console indexing reviewed', kind: 'manual' },
    ],
  },
  {
    key: 'forms',
    title: 'Forms & Lead Generation',
    items: [
      { key: 'count', label: 'Form submissions counted for the month', kind: 'auto' },
      { key: 'testInquiry', label: 'Test inquiry submitted end-to-end', kind: 'manual' },
      { key: 'delivery', label: 'Email delivery confirmed', kind: 'manual' },
      { key: 'spamFilter', label: 'Spam filtering confirmed', kind: 'manual' },
    ],
  },
  {
    key: 'analytics',
    title: 'Analytics Overview',
    items: [
      { key: 'traffic', label: 'Traffic reviewed (visitors & sessions)', kind: 'auto' },
      { key: 'topPages', label: 'Top-performing pages identified', kind: 'auto' },
      { key: 'trend', label: 'Month-over-month trend computed', kind: 'auto' },
    ],
  },
  {
    key: 'content',
    title: 'Content & Gallery',
    items: [
      { key: 'images', label: 'Homepage images loading', kind: 'auto' },
      { key: 'placeholder', label: 'No placeholder/outdated content detected', kind: 'auto' },
      { key: 'newProjects', label: 'Confirmed new content/projects with client', kind: 'manual' },
    ],
  },
  {
    key: 'hosting',
    title: 'Hosting & Infrastructure',
    items: [
      { key: 'deploy', label: 'Latest production deploy succeeded', kind: 'auto' },
      { key: 'failedDeploys', label: 'Recent deploy history reviewed', kind: 'auto' },
      { key: 'domains', label: 'Domains configured & verified', kind: 'auto' },
      { key: 'config', label: 'Hosting configuration reviewed', kind: 'manual' },
    ],
  },
];

export const SECTION_KEYS = SECTION_DEFS.map(s => s.key) as SectionKey[];

/** Look up a section definition by key. */
export function sectionDef(key: SectionKey): SectionDef {
  const def = SECTION_DEFS.find(s => s.key === key);
  if (!def) throw new Error(`Unknown report section: ${key}`);
  return def;
}

/**
 * Build the default (pre-automation, all-pending) item list for a section.
 * Used by the builder to seed a blank report and by check modules as a base
 * they selectively mark pass/fail.
 */
export function blankItems(key: SectionKey): CheckItem[] {
  return sectionDef(key).items.map(def => ({
    key: def.key,
    label: def.label,
    kind: def.kind,
    outcome: 'pending' as ItemOutcome,
  }));
}

export interface CheckItem {
  key: string;
  label: string;
  kind: ItemKind;
  outcome: ItemOutcome;
  /** Measured value or reason, e.g. "HTTP 200", "expires in 320 days". */
  detail?: string;
}

/**
 * Set an item's outcome (and optional measured detail) in place, looked up by
 * key so modules never depend on item ordering.
 */
export function markItem(
  items: CheckItem[],
  key: string,
  outcome: ItemOutcome,
  detail?: string,
): void {
  const item = items.find(i => i.key === key);
  if (!item) return;
  item.outcome = outcome;
  if (detail !== undefined) item.detail = detail;
}
