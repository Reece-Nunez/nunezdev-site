/**
 * Unit tests for the Google Ads pure transforms. Run with:
 *
 *   npm test
 *
 * No DB, no network, no credentials. These pin the metric-math and row-mapping
 * that turn raw Ads API rows into stored rows and dashboard KPIs — the parts
 * most likely to silently drift (micros→dollars, divide-by-zero on empty
 * ranges, number/string coercion from the API).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  num,
  str,
  normalizeCustomerId,
  microsToCurrency,
  prettyEnum,
  toGaqlDate,
  gaqlDateRange,
  mapCampaignRow,
  mapKeywordRow,
  deriveKpis,
  aggregateByCampaign,
  aggregateByKeyword,
  dailySeries,
  type RawAdsRow,
  type CampaignMetricRow,
  type KeywordMetricRow,
} from "./googleAdsTransform";

// Minimal campaign-row factory for aggregation tests.
function campRow(over: Partial<CampaignMetricRow>): CampaignMetricRow {
  return {
    date: "2026-06-15",
    customer_id: "1234567890",
    campaign_id: "111",
    campaign_name: "Search",
    status: "ENABLED",
    channel_type: "SEARCH",
    impressions: 0,
    clicks: 0,
    cost_micros: 0,
    conversions: 0,
    conversions_value: 0,
    ...over,
  };
}

describe("coercion helpers", () => {
  it("num coerces numeric strings and rejects garbage", () => {
    assert.equal(num(5), 5);
    assert.equal(num("42"), 42);
    assert.equal(num("3.5"), 3.5);
    assert.equal(num("nope"), 0);
    assert.equal(num(undefined), 0);
    assert.equal(num(null), 0);
    assert.equal(num(NaN), 0);
  });

  it("str passes through and applies the fallback", () => {
    assert.equal(str("hi"), "hi");
    assert.equal(str(123), "123");
    assert.equal(str(null, "(none)"), "(none)");
    assert.equal(str(undefined, "(none)"), "(none)");
  });

  it("normalizeCustomerId strips dashes and spaces", () => {
    assert.equal(normalizeCustomerId("123-456-7890"), "1234567890");
    assert.equal(normalizeCustomerId("123 456 7890"), "1234567890");
    assert.equal(normalizeCustomerId("1234567890"), "1234567890");
  });
});

describe("microsToCurrency", () => {
  it("converts micros to dollars rounded to cents", () => {
    assert.equal(microsToCurrency(1_000_000), 1);
    assert.equal(microsToCurrency(2_500_000), 2.5);
    assert.equal(microsToCurrency(0), 0);
    // 1234567 micros = $1.234567 → rounds to $1.23
    assert.equal(microsToCurrency(1_234_567), 1.23);
  });
});

describe("prettyEnum", () => {
  it("title-cases SCREAMING_SNAKE values", () => {
    assert.equal(prettyEnum("EXACT"), "Exact");
    assert.equal(prettyEnum("BROAD_MATCH"), "Broad match");
    assert.equal(prettyEnum("ENABLED"), "Enabled");
    assert.equal(prettyEnum(""), "");
  });
});

describe("date helpers", () => {
  it("toGaqlDate formats as YYYY-MM-DD (UTC)", () => {
    assert.equal(toGaqlDate(new Date("2026-06-16T23:30:00Z")), "2026-06-16");
  });

  it("gaqlDateRange builds an inclusive window ending at end", () => {
    const r = gaqlDateRange(new Date("2026-06-16T12:00:00Z"), 7);
    assert.deepEqual(r, { start: "2026-06-10", end: "2026-06-16" });
  });

  it("gaqlDateRange of 1 day is a single date", () => {
    const r = gaqlDateRange(new Date("2026-06-16T12:00:00Z"), 1);
    assert.deepEqual(r, { start: "2026-06-16", end: "2026-06-16" });
  });
});

describe("mapCampaignRow", () => {
  it("flattens a nested API row, coercing string metrics", () => {
    const raw: RawAdsRow = {
      campaign: {
        id: 111,
        name: "Garza Auto - Search",
        status: "ENABLED",
        advertising_channel_type: "SEARCH",
      },
      // The Ads API often returns cost_micros / impressions as strings.
      metrics: {
        impressions: "1200",
        clicks: "84",
        cost_micros: "5000000",
        conversions: 6,
        conversions_value: 900,
      },
      segments: { date: "2026-06-15" },
    };
    assert.deepEqual(mapCampaignRow(raw, "1234567890"), {
      date: "2026-06-15",
      customer_id: "1234567890",
      campaign_id: "111",
      campaign_name: "Garza Auto - Search",
      status: "ENABLED",
      channel_type: "SEARCH",
      impressions: 1200,
      clicks: 84,
      cost_micros: 5_000_000,
      conversions: 6,
      conversions_value: 900,
    });
  });

  it("falls back gracefully on a sparse row", () => {
    const row = mapCampaignRow({ segments: { date: "2026-06-15" } }, "1234567890");
    assert.equal(row.campaign_name, "(unknown campaign)");
    assert.equal(row.channel_type, null);
    assert.equal(row.impressions, 0);
    assert.equal(row.cost_micros, 0);
  });
});

describe("mapKeywordRow", () => {
  it("flattens keyword/ad-group fields", () => {
    const raw: RawAdsRow = {
      campaign: { id: 111, name: "Garza Auto - Search" },
      ad_group: { id: 222, name: "Brakes" },
      ad_group_criterion: {
        criterion_id: 333,
        keyword: { text: "brake repair near me", match_type: "PHRASE" },
      },
      metrics: { impressions: 300, clicks: 30, cost_micros: 2_000_000, conversions: 3, conversions_value: 450 },
      segments: { date: "2026-06-15" },
    };
    const row = mapKeywordRow(raw, "1234567890");
    assert.equal(row.ad_group_id, "222");
    assert.equal(row.ad_group_name, "Brakes");
    assert.equal(row.criterion_id, "333");
    assert.equal(row.keyword_text, "brake repair near me");
    assert.equal(row.match_type, "PHRASE");
    assert.equal(row.cost_micros, 2_000_000);
  });
});

describe("deriveKpis", () => {
  it("aggregates rows and computes derived rates", () => {
    const k = deriveKpis([
      { impressions: 1000, clicks: 100, cost_micros: 5_000_000, conversions: 5, conversions_value: 750 },
      { impressions: 1000, clicks: 100, cost_micros: 5_000_000, conversions: 5, conversions_value: 750 },
    ]);
    assert.equal(k.impressions, 2000);
    assert.equal(k.clicks, 200);
    assert.equal(k.cost, 10); // $10 total
    assert.equal(k.conversions, 10);
    assert.equal(k.conversionsValue, 1500);
    assert.equal(k.ctr, 0.1); // 200/2000
    assert.equal(k.avgCpc, 0.05); // $10 / 200 clicks
    assert.equal(k.costPerConversion, 1); // $10 / 10 conv
    assert.equal(k.conversionRate, 0.05); // 10 / 200
  });

  it("returns zeroes (never NaN) for an empty range", () => {
    const k = deriveKpis([]);
    assert.equal(k.ctr, 0);
    assert.equal(k.avgCpc, 0);
    assert.equal(k.costPerConversion, 0);
    assert.equal(k.conversionRate, 0);
    assert.equal(k.cost, 0);
  });
});

describe("aggregateByCampaign", () => {
  it("sums daily rows per campaign and sorts by cost desc", () => {
    const rows: CampaignMetricRow[] = [
      campRow({ campaign_id: "A", campaign_name: "Cheap", cost_micros: 1_000_000, clicks: 10, impressions: 100 }),
      campRow({ campaign_id: "A", date: "2026-06-16", cost_micros: 1_000_000, clicks: 10, impressions: 100 }),
      campRow({ campaign_id: "B", campaign_name: "Pricey", cost_micros: 9_000_000, clicks: 5, impressions: 50 }),
    ];
    const agg = aggregateByCampaign(rows);
    assert.equal(agg.length, 2);
    // B costs more → comes first.
    assert.equal(agg[0].campaign_id, "B");
    assert.equal(agg[0].cost, 9);
    // A's two days summed.
    assert.equal(agg[1].campaign_id, "A");
    assert.equal(agg[1].cost, 2);
    assert.equal(agg[1].clicks, 20);
  });

  it("uses the newest row for the campaign's display name/status", () => {
    const rows: CampaignMetricRow[] = [
      campRow({ campaign_id: "A", date: "2026-06-10", campaign_name: "Old name", status: "ENABLED" }),
      campRow({ campaign_id: "A", date: "2026-06-16", campaign_name: "New name", status: "PAUSED" }),
    ];
    const agg = aggregateByCampaign(rows);
    assert.equal(agg[0].campaign_name, "New name");
    assert.equal(agg[0].status, "PAUSED");
  });
});

describe("aggregateByKeyword", () => {
  it("sums per criterion and keeps keyword identity", () => {
    const kw = (over: Partial<KeywordMetricRow>): KeywordMetricRow => ({
      date: "2026-06-15",
      customer_id: "1234567890",
      campaign_id: "111",
      campaign_name: "Search",
      ad_group_id: "222",
      ad_group_name: "Brakes",
      criterion_id: "333",
      keyword_text: "brake repair",
      match_type: "PHRASE",
      impressions: 0,
      clicks: 0,
      cost_micros: 0,
      conversions: 0,
      conversions_value: 0,
      ...over,
    });
    const agg = aggregateByKeyword([
      kw({ cost_micros: 1_000_000, clicks: 4 }),
      kw({ date: "2026-06-16", cost_micros: 2_000_000, clicks: 6 }),
    ]);
    assert.equal(agg.length, 1);
    assert.equal(agg[0].keyword_text, "brake repair");
    assert.equal(agg[0].cost, 3);
    assert.equal(agg[0].clicks, 10);
  });
});

describe("dailySeries", () => {
  it("totals per date and sorts oldest → newest", () => {
    const series = dailySeries([
      campRow({ date: "2026-06-16", cost_micros: 1_000_000, clicks: 5 }),
      campRow({ date: "2026-06-15", cost_micros: 2_000_000, clicks: 3 }),
      campRow({ date: "2026-06-15", campaign_id: "B", cost_micros: 500_000, clicks: 2 }),
    ]);
    assert.deepEqual(
      series.map((p) => p.date),
      ["2026-06-15", "2026-06-16"],
    );
    // Two campaigns on the 15th: $2.00 + $0.50 = $2.50, 5 clicks.
    assert.equal(series[0].cost, 2.5);
    assert.equal(series[0].clicks, 5);
    assert.equal(series[1].cost, 1);
  });
});
