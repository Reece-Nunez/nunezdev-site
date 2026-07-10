/**
 * Month-over-month site snapshots.
 *
 * Each report run stores the month's Search Console totals and sitemap URL list
 * for the site, then reads back the previous month to compute:
 *   * SEO trend      — clicks/impressions delta (enriches the SEO section)
 *   * new content    — sitemap URLs added since last month (enriches Content)
 *
 * The delta math is pure and unit-tested; the fetch/DB helpers are thin shells.
 * Nothing here changes an item's kind — it only enriches notes/recommendations,
 * so the honest auto/manual labelling in sections.ts is preserved.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface StoredSnapshot {
  gscClicks: number | null;
  gscImpressions: number | null;
  sitemapUrls: string[];
}

/** Percentage change, or null when there's no positive baseline to divide by. */
function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Describe the search-performance trend vs the previous month. Returns an empty
 * note when there's no usable baseline (first month, or previous had 0 clicks).
 */
export function computeGscTrend(
  current: { clicks: number; impressions: number },
  previous: { clicks: number; impressions: number },
): { note: string; recommendation?: string } {
  const parts: string[] = [];
  let recommendation: string | undefined;

  const clicksPct = pctChange(current.clicks, previous.clicks);
  if (clicksPct !== null) {
    const dir = clicksPct > 0 ? `up ${clicksPct}%` : clicksPct < 0 ? `down ${Math.abs(clicksPct)}%` : 'flat';
    parts.push(`Search clicks ${dir} vs last month (${previous.clicks.toLocaleString()} → ${current.clicks.toLocaleString()})`);
    if (clicksPct <= -20) {
      recommendation = `Search clicks fell ${Math.abs(clicksPct)}% month-over-month — review rankings for your top queries in Search Console.`;
    }
  }

  const imprPct = pctChange(current.impressions, previous.impressions);
  if (imprPct !== null) {
    const dir = imprPct > 0 ? `up ${imprPct}%` : imprPct < 0 ? `down ${Math.abs(imprPct)}%` : 'flat';
    parts.push(`impressions ${dir}`);
  }

  return { note: parts.join(', '), recommendation };
}

/** Compare two sitemap URL lists. `added` is what's new since last month. */
export function computeSitemapDiff(
  currentUrls: string[],
  previousUrls: string[],
): { added: string[]; removed: string[]; note: string } {
  const prev = new Set(previousUrls);
  const cur = new Set(currentUrls);
  const added = currentUrls.filter(u => !prev.has(u));
  const removed = previousUrls.filter(u => !cur.has(u));

  const parts: string[] = [];
  if (added.length) parts.push(`${added.length} new page${added.length === 1 ? '' : 's'} since last month`);
  if (removed.length) parts.push(`${removed.length} page${removed.length === 1 ? '' : 's'} removed`);

  return { added, removed, note: parts.join(', ') };
}

/**
 * Fetch the site's sitemap and return its <loc> URLs (deduped). Best-effort:
 * returns [] on any error. For a sitemap index this yields the child sitemap
 * URLs rather than page URLs — still a stable set to diff against.
 */
export async function fetchSitemapUrls(websiteUrl: string): Promise<string[]> {
  try {
    const sitemapUrl = `${websiteUrl.replace(/\/$/, '')}/sitemap.xml`;
    const res = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'NunezDev-ReportBot/1.0' },
    });
    if (!res.ok) return [];
    const text = await res.text();
    const locs = [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1].trim());
    return Array.from(new Set(locs));
  } catch {
    return [];
  }
}

/** Most recent snapshot strictly before `reportMonth`, or null if none. */
export async function loadPreviousSnapshot(
  supabase: SupabaseClient,
  siteId: string,
  reportMonth: string,
): Promise<StoredSnapshot | null> {
  const { data } = await supabase
    .from('client_site_snapshots')
    .select('gsc_clicks, gsc_impressions, sitemap_urls')
    .eq('site_id', siteId)
    .lt('report_month', reportMonth)
    .order('report_month', { ascending: false })
    .limit(1);

  const row = data?.[0];
  if (!row) return null;
  return {
    gscClicks: row.gsc_clicks ?? null,
    gscImpressions: row.gsc_impressions ?? null,
    sitemapUrls: Array.isArray(row.sitemap_urls) ? row.sitemap_urls : [],
  };
}

/** Upsert this month's snapshot (one row per site+month). Best-effort. */
export async function saveSnapshot(
  supabase: SupabaseClient,
  params: { orgId: string; siteId: string; reportMonth: string; snapshot: StoredSnapshot },
): Promise<void> {
  const { orgId, siteId, reportMonth, snapshot } = params;
  await supabase.from('client_site_snapshots').upsert(
    {
      org_id: orgId,
      site_id: siteId,
      report_month: reportMonth,
      gsc_clicks: snapshot.gscClicks,
      gsc_impressions: snapshot.gscImpressions,
      sitemap_urls: snapshot.sitemapUrls,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'site_id,report_month' },
  );
}
