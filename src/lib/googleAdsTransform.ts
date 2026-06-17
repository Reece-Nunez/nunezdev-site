/**
 * Pure transforms for the Google Ads integration.
 *
 * This module has NO external imports on purpose: it holds the row-mapping
 * and metric-math that turns raw Google Ads API rows into the flat shapes we
 * store in Supabase and render in the dashboard. Keeping it dependency-free
 * means the unit tests can exercise it without pulling in the gRPC
 * `google-ads-api` client (which needs real credentials to construct).
 *
 * The client factory and GAQL queries live in `googleAds.ts`; the Supabase
 * upsert lives in `googleAdsSync.ts`. Both import the helpers from here.
 */

// ── Stored row shapes (mirror the columns in
//    database/migrations/create_google_ads_metrics.sql) ─────────────

export interface CampaignMetricRow {
  date: string; // YYYY-MM-DD
  customer_id: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  channel_type: string | null;
  impressions: number;
  clicks: number;
  cost_micros: number; // raw micros — the precise source of truth; UI derives dollars
  conversions: number;
  conversions_value: number;
}

export interface KeywordMetricRow {
  date: string; // YYYY-MM-DD
  customer_id: string;
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  criterion_id: string;
  keyword_text: string;
  match_type: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
}

// Loosely-typed raw row as returned by `customer.query(...)`. The Ads API
// nests fields under the resource they belong to (campaign/metrics/segments).
// Everything is optional because a GAQL SELECT only populates the columns it
// asked for, and numeric fields can arrive as number or string.
export interface RawAdsRow {
  campaign?: {
    id?: number | string;
    name?: string;
    status?: string | number;
    advertising_channel_type?: string | number;
  };
  ad_group?: { id?: number | string; name?: string };
  ad_group_criterion?: {
    criterion_id?: number | string;
    keyword?: { text?: string; match_type?: string | number };
  };
  metrics?: {
    impressions?: number | string;
    clicks?: number | string;
    cost_micros?: number | string;
    conversions?: number | string;
    conversions_value?: number | string;
  };
  segments?: { date?: string };
}

// ── Coercion helpers ──────────────────────────────────────────────

/** Coerce an unknown API value to a finite number; non-numeric → 0. */
export function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce an unknown API value to a string, with a fallback for null/undefined. */
export function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

/** Strip everything but digits — Google shows customer IDs as 123-456-7890. */
export function normalizeCustomerId(id: string): string {
  return id.replace(/[^0-9]/g, "");
}

/** Convert Google's micros (1e6 = 1 currency unit) to dollars, rounded to cents. */
export function microsToCurrency(micros: number): number {
  return Math.round((micros / 1e6) * 100) / 100;
}

/** Prettify a SCREAMING_SNAKE enum (EXACT → Exact, BROAD_MATCH → Broad match). */
export function prettyEnum(value: string): string {
  if (!value) return "";
  const lower = value.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// ── Date helpers ──────────────────────────────────────────────────

/** YYYY-MM-DD (UTC) — the format GAQL's segments.date filter expects. */
export function toGaqlDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Inclusive [start, end] window ending at `end`, spanning `days` days.
 * gaqlDateRange(2026-06-16, 7) → { start: 2026-06-10, end: 2026-06-16 }.
 * Takes an explicit end date so it stays pure (testable without the clock).
 */
export function gaqlDateRange(end: Date, days: number): { start: string; end: string } {
  const span = Math.max(1, Math.floor(days));
  const startDate = new Date(end.getTime() - (span - 1) * 86_400_000);
  return { start: toGaqlDate(startDate), end: toGaqlDate(end) };
}

// ── Row mappers ───────────────────────────────────────────────────

export function mapCampaignRow(raw: RawAdsRow, customerId: string): CampaignMetricRow {
  return {
    date: str(raw.segments?.date),
    customer_id: customerId,
    campaign_id: str(raw.campaign?.id),
    campaign_name: str(raw.campaign?.name, "(unknown campaign)"),
    status: str(raw.campaign?.status),
    channel_type:
      raw.campaign?.advertising_channel_type != null
        ? str(raw.campaign.advertising_channel_type)
        : null,
    impressions: num(raw.metrics?.impressions),
    clicks: num(raw.metrics?.clicks),
    cost_micros: num(raw.metrics?.cost_micros),
    conversions: num(raw.metrics?.conversions),
    conversions_value: num(raw.metrics?.conversions_value),
  };
}

export function mapKeywordRow(raw: RawAdsRow, customerId: string): KeywordMetricRow {
  return {
    date: str(raw.segments?.date),
    customer_id: customerId,
    campaign_id: str(raw.campaign?.id),
    campaign_name: str(raw.campaign?.name, "(unknown campaign)"),
    ad_group_id: str(raw.ad_group?.id),
    ad_group_name: str(raw.ad_group?.name, "(unknown ad group)"),
    criterion_id: str(raw.ad_group_criterion?.criterion_id),
    keyword_text: str(raw.ad_group_criterion?.keyword?.text),
    match_type: str(raw.ad_group_criterion?.keyword?.match_type),
    impressions: num(raw.metrics?.impressions),
    clicks: num(raw.metrics?.clicks),
    cost_micros: num(raw.metrics?.cost_micros),
    conversions: num(raw.metrics?.conversions),
    conversions_value: num(raw.metrics?.conversions_value),
  };
}

// ── Derived KPIs ──────────────────────────────────────────────────

export interface Kpis {
  impressions: number;
  clicks: number;
  costMicros: number;
  cost: number; // dollars
  conversions: number;
  conversionsValue: number;
  ctr: number; // clicks / impressions, 0..1
  avgCpc: number; // dollars per click
  costPerConversion: number; // dollars per conversion
  conversionRate: number; // conversions / clicks, 0..1
}

type MetricLike = Pick<
  CampaignMetricRow,
  "impressions" | "clicks" | "cost_micros" | "conversions" | "conversions_value"
>;

/**
 * Aggregate a set of metric rows into the headline KPIs. Rate fields guard
 * against divide-by-zero (no impressions → 0% CTR, not NaN) so empty date
 * ranges render cleanly instead of showing "NaN%".
 */
export function deriveKpis(rows: MetricLike[]): Kpis {
  let impressions = 0;
  let clicks = 0;
  let costMicros = 0;
  let conversions = 0;
  let conversionsValue = 0;

  for (const r of rows) {
    impressions += r.impressions;
    clicks += r.clicks;
    costMicros += r.cost_micros;
    conversions += r.conversions;
    conversionsValue += r.conversions_value;
  }

  const cost = microsToCurrency(costMicros);
  return {
    impressions,
    clicks,
    costMicros,
    cost,
    conversions,
    conversionsValue,
    ctr: impressions ? clicks / impressions : 0,
    avgCpc: clicks ? cost / clicks : 0,
    costPerConversion: conversions ? cost / conversions : 0,
    conversionRate: clicks ? conversions / clicks : 0,
  };
}

// ── Aggregation for the dashboard ─────────────────────────────────
// The dashboard stores one row per (campaign|keyword, date). To show a
// "last 30 days" table we collapse those daily rows back to one row per
// campaign/keyword with summed metrics + re-derived rates. Pure so it's
// unit-testable and runs equally in the page (server component) or a route.

export interface CampaignAgg extends Kpis {
  campaign_id: string;
  campaign_name: string;
  status: string;
  channel_type: string | null;
}

export interface KeywordAgg extends Kpis {
  criterion_id: string;
  keyword_text: string;
  match_type: string;
  campaign_name: string;
  ad_group_name: string;
}

/** One point per calendar date, summed across all campaigns — drives the trend chart. */
export interface DailyPoint {
  date: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

/** Collapse daily campaign rows to one aggregated row per campaign, costliest first. */
export function aggregateByCampaign(rows: CampaignMetricRow[]): CampaignAgg[] {
  const groups = new Map<string, CampaignMetricRow[]>();
  for (const r of rows) {
    const list = groups.get(r.campaign_id);
    if (list) list.push(r);
    else groups.set(r.campaign_id, [r]);
  }

  const out: CampaignAgg[] = [];
  for (const [campaign_id, list] of groups) {
    // The newest row carries the current name/status (a campaign can be
    // renamed or paused mid-range; show its latest identity).
    const latest = list.reduce((a, b) => (a.date >= b.date ? a : b));
    out.push({
      campaign_id,
      campaign_name: latest.campaign_name,
      status: latest.status,
      channel_type: latest.channel_type,
      ...deriveKpis(list),
    });
  }
  return out.sort((a, b) => b.cost - a.cost);
}

/** Collapse daily keyword rows to one aggregated row per keyword, costliest first. */
export function aggregateByKeyword(rows: KeywordMetricRow[]): KeywordAgg[] {
  const groups = new Map<string, KeywordMetricRow[]>();
  for (const r of rows) {
    const list = groups.get(r.criterion_id);
    if (list) list.push(r);
    else groups.set(r.criterion_id, [r]);
  }

  const out: KeywordAgg[] = [];
  for (const [criterion_id, list] of groups) {
    const latest = list.reduce((a, b) => (a.date >= b.date ? a : b));
    out.push({
      criterion_id,
      keyword_text: latest.keyword_text,
      match_type: latest.match_type,
      campaign_name: latest.campaign_name,
      ad_group_name: latest.ad_group_name,
      ...deriveKpis(list),
    });
  }
  return out.sort((a, b) => b.cost - a.cost);
}

/** Per-date totals across all campaigns, oldest → newest, for the trend chart. */
export function dailySeries(rows: CampaignMetricRow[]): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  for (const r of rows) {
    const p = byDate.get(r.date) ?? {
      date: r.date,
      cost: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
    };
    p.cost += microsToCurrency(r.cost_micros);
    p.clicks += r.clicks;
    p.impressions += r.impressions;
    p.conversions += r.conversions;
    byDate.set(r.date, p);
  }
  // Round cost after summing to avoid accumulated float drift in the chart.
  return [...byDate.values()]
    .map((p) => ({ ...p, cost: Math.round(p.cost * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
