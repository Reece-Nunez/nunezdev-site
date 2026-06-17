/**
 * Google Ads → Supabase sync (the write path).
 *
 * Shared by the daily cron (/api/cron/leadgen-google-ads-sync) and the manual
 * dashboard refresh (/api/dashboard/google-ads/refresh). Fetches the last
 * `days` of campaign + keyword metrics and upserts them into the snapshot
 * tables. Upserts are idempotent on the unique indexes from
 * create_google_ads_metrics.sql, so re-running for an overlapping window just
 * overwrites those days' rows (today's numbers keep changing through the day).
 */
import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchCampaignMetrics, fetchKeywordMetrics, isConfigured } from "./googleAds";
import { gaqlDateRange } from "./googleAdsTransform";

export interface SyncResult {
  configured: boolean;
  days: number;
  start: string;
  end: string;
  campaignRows: number;
  keywordRows: number;
}

/**
 * Sync the trailing `days` window. Returns `configured: false` (a no-op) when
 * credentials are absent, so callers can surface a clean "not set up yet"
 * message instead of throwing.
 */
export async function syncGoogleAds(days = 30): Promise<SyncResult> {
  if (!isConfigured()) {
    return { configured: false, days, start: "", end: "", campaignRows: 0, keywordRows: 0 };
  }

  const { start, end } = gaqlDateRange(new Date(), days);
  const [campaigns, keywords] = await Promise.all([
    fetchCampaignMetrics(start, end),
    fetchKeywordMetrics(start, end),
  ]);

  const sb = supabaseAdmin();
  const synced_at = new Date().toISOString();

  if (campaigns.length) {
    const { error } = await sb
      .from("google_ads_campaign_metrics")
      .upsert(
        campaigns.map((c) => ({ ...c, synced_at })),
        { onConflict: "date,campaign_id" },
      );
    if (error) throw new Error(`campaign upsert failed: ${error.message}`);
  }

  if (keywords.length) {
    const { error } = await sb
      .from("google_ads_keyword_metrics")
      .upsert(
        keywords.map((k) => ({ ...k, synced_at })),
        { onConflict: "date,ad_group_id,criterion_id" },
      );
    if (error) throw new Error(`keyword upsert failed: ${error.message}`);
  }

  return {
    configured: true,
    days,
    start,
    end,
    campaignRows: campaigns.length,
    keywordRows: keywords.length,
  };
}
