import { googleServiceFactory } from '@/lib/google/googleServiceFactory';

/**
 * Pull Search Console search-performance totals for the report month.
 *
 * Kept in its own module (not seo.ts) so the on-page SEO checks — and their
 * unit test — stay free of the Google auth dependency. The orchestrator merges
 * the result into the SEO section when a client has a gsc_site_url configured.
 *
 * Requires the service account to be added as a user on the client's Search
 * Console property (direct access; see googleServiceFactory). Until that's
 * granted, this returns `configured: false` and the report falls back to the
 * manual "Search Console reviewed" checkbox.
 */

function lastDayOfMonth(dateStr: string): string {
  const d = new Date(dateStr);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

export interface SearchConsoleResult {
  /** True only when a site URL was provided AND the query succeeded. */
  configured: boolean;
  clicks?: number;
  impressions?: number;
  ctr?: number; // 0–1 ratio
  position?: number;
  /** Short summary for the SEO checklist item. */
  detail?: string;
  /** Longer note (or error reason) for the section notes. */
  note?: string;
}

export async function checkSearchConsole(
  gscSiteUrl: string | null | undefined,
  reportMonth: string,
): Promise<SearchConsoleResult> {
  if (!gscSiteUrl) return { configured: false };

  const sc = await googleServiceFactory.getSearchConsoleClient();
  if (!sc) return { configured: false, note: 'Search Console API unavailable' };

  try {
    const startDate = reportMonth;
    const endDate = lastDayOfMonth(reportMonth);
    const res = await sc.searchanalytics.query({
      siteUrl: gscSiteUrl,
      requestBody: { startDate, endDate, dimensions: [], rowLimit: 1 },
    });

    const row = res?.data?.rows?.[0];
    if (!row) {
      return { configured: true, clicks: 0, impressions: 0, ctr: 0, position: 0, detail: 'No search data this month' };
    }

    const clicks = Math.round(row.clicks || 0);
    const impressions = Math.round(row.impressions || 0);
    const ctr = row.ctr || 0;
    const position = row.position || 0;
    const detail = `${clicks.toLocaleString()} clicks, ${impressions.toLocaleString()} impressions, avg pos ${position.toFixed(1)}`;
    return { configured: true, clicks, impressions, ctr, position, detail, note: `Search Console: ${detail}` };
  } catch (e: any) {
    return { configured: false, note: `Search Console query failed: ${e.message}` };
  }
}
