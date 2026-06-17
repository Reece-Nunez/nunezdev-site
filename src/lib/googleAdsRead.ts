/**
 * Google Ads dashboard reads (the read path).
 *
 * The /dashboard/leadgen/ads page reads cached snapshots from Supabase — never
 * live from Google — and aggregates the daily rows into the campaign/keyword
 * tables, trend series, and headline KPIs using the pure helpers in
 * googleAdsTransform.ts. Reads go through the service-role admin client; the
 * page itself is gated by requireOwner().
 */
import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { isConfigured } from "./googleAds";
import {
  aggregateByCampaign,
  aggregateByKeyword,
  dailySeries,
  deriveKpis,
  gaqlDateRange,
  type CampaignMetricRow,
  type KeywordMetricRow,
  type CampaignAgg,
  type KeywordAgg,
  type DailyPoint,
  type Kpis,
} from "./googleAdsTransform";

export interface AdsOverview {
  configured: boolean;
  hasData: boolean;
  days: number;
  start: string;
  end: string;
  lastSyncedAt: string | null;
  kpis: Kpis;
  campaigns: CampaignAgg[];
  keywords: KeywordAgg[];
  series: DailyPoint[];
}

const EMPTY_KPIS: Kpis = {
  impressions: 0,
  clicks: 0,
  costMicros: 0,
  cost: 0,
  conversions: 0,
  conversionsValue: 0,
  ctr: 0,
  avgCpc: 0,
  costPerConversion: 0,
  conversionRate: 0,
};

/**
 * Everything the Ads dashboard needs for a trailing `days` window. Returns a
 * fully-zeroed overview (never throws) when unconfigured or when no snapshots
 * exist yet, so the page renders an empty state rather than an error.
 */
export async function getAdsOverview(days = 30): Promise<AdsOverview> {
  const { start, end } = gaqlDateRange(new Date(), days);
  const base = {
    configured: isConfigured(),
    hasData: false,
    days,
    start,
    end,
    lastSyncedAt: null as string | null,
    kpis: EMPTY_KPIS,
    campaigns: [] as CampaignAgg[],
    keywords: [] as KeywordAgg[],
    series: [] as DailyPoint[],
  };

  const sb = supabaseAdmin();

  // Keyword pull is capped — a busy account can have thousands of keyword×day
  // rows; the costliest are what matter for the table, and the campaign tables
  // (uncapped within the window) carry the authoritative totals.
  const [campaignRes, keywordRes] = await Promise.all([
    sb
      .from("google_ads_campaign_metrics")
      .select("*")
      .gte("date", start)
      .lte("date", end),
    sb
      .from("google_ads_keyword_metrics")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("cost_micros", { ascending: false })
      .limit(5000),
  ]);

  // A missing table (migration not applied) or any read error degrades to the
  // empty state — the page still renders with a "run the migration / sync"
  // hint rather than a 500.
  if (campaignRes.error || keywordRes.error) {
    return base;
  }

  const campaignRows = (campaignRes.data ?? []) as CampaignMetricRow[];
  const keywordRows = (keywordRes.data ?? []) as KeywordMetricRow[];

  if (campaignRows.length === 0 && keywordRows.length === 0) {
    return base;
  }

  const lastSyncedAt = campaignRows.reduce<string | null>((max, r) => {
    const s = (r as CampaignMetricRow & { synced_at?: string }).synced_at ?? null;
    return s && (!max || s > max) ? s : max;
  }, null);

  return {
    ...base,
    hasData: true,
    lastSyncedAt,
    kpis: deriveKpis(campaignRows),
    campaigns: aggregateByCampaign(campaignRows),
    keywords: aggregateByKeyword(keywordRows),
    series: dailySeries(campaignRows),
  };
}
