/**
 * Google Ads API client + GAQL queries.
 *
 * The Ads API is gRPC-based and isn't part of the `googleapis` package, so we
 * use the `google-ads-api` library. Unlike the rest of our Google integration
 * (`@/lib/google/*`), which uses a Workspace service account with domain-wide
 * delegation, the Ads API requires OAuth *user* credentials — a developer
 * token plus a refresh token for the account being queried. See README
 * ("Google Ads integration") for how to obtain each value.
 *
 * Pure mapping/metric helpers live in `googleAdsTransform.ts` (and are unit
 * tested there). This module only owns the client + the two GAQL queries.
 */
import "server-only";
import { GoogleAdsApi } from "google-ads-api";
import {
  mapCampaignRow,
  mapKeywordRow,
  normalizeCustomerId,
  type CampaignMetricRow,
  type KeywordMetricRow,
  type RawAdsRow,
} from "./googleAdsTransform";

/**
 * True when every required env var is set. The whole feature degrades to an
 * empty state when false, so the app deploys cleanly before credentials exist.
 * GOOGLE_ADS_LOGIN_CUSTOMER_ID is optional (only needed when querying through
 * a manager/MCC account).
 */
export function isConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_CUSTOMER_ID,
  );
}

// The API client is stateless config; cache it across invocations. The
// per-account Customer handle is cheap and created per call.
let _api: GoogleAdsApi | null = null;

type Customer = ReturnType<GoogleAdsApi["Customer"]>;

function getCustomer(): Customer {
  if (!isConfigured()) {
    throw new Error(
      "Google Ads is not configured — set GOOGLE_ADS_* env vars (see README).",
    );
  }
  if (!_api) {
    _api = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    });
  }
  const loginId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  return _api.Customer({
    customer_id: normalizeCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID!),
    login_customer_id: loginId ? normalizeCustomerId(loginId) : undefined,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });
}

/** The customer id we query, digits-only — also stored on every metric row. */
export function configuredCustomerId(): string {
  return normalizeCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID ?? "");
}

// Our date strings come from gaqlDateRange (never user input), but guard the
// format anyway before interpolating into GAQL — defence-in-depth against a
// future caller passing raw input into a query string.
function assertGaqlDate(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error(`Invalid GAQL date: ${d}`);
  }
  return d;
}

/** Per-campaign, per-day metrics for the inclusive [start, end] window. */
export async function fetchCampaignMetrics(
  start: string,
  end: string,
): Promise<CampaignMetricRow[]> {
  const customer = getCustomer();
  const s = assertGaqlDate(start);
  const e = assertGaqlDate(end);
  const rows = (await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      segments.date
    FROM campaign
    WHERE segments.date BETWEEN '${s}' AND '${e}'
    ORDER BY segments.date DESC
  `)) as unknown as RawAdsRow[];

  const customerId = configuredCustomerId();
  return rows.map((r) => mapCampaignRow(r, customerId));
}

/**
 * Per-keyword, per-day metrics for the window. Restricted to keywords with at
 * least one impression in range — keeps the result set bounded on large
 * accounts (a keyword_view row exists for every keyword × day otherwise).
 */
export async function fetchKeywordMetrics(
  start: string,
  end: string,
): Promise<KeywordMetricRow[]> {
  const customer = getCustomer();
  const s = assertGaqlDate(start);
  const e = assertGaqlDate(end);
  const rows = (await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      segments.date
    FROM keyword_view
    WHERE segments.date BETWEEN '${s}' AND '${e}'
      AND metrics.impressions > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 10000
  `)) as unknown as RawAdsRow[];

  const customerId = configuredCustomerId();
  return rows.map((r) => mapKeywordRow(r, customerId));
}
