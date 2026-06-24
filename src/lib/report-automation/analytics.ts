import { blankItems, markItem, type SectionStatus } from './sections';
import type { AnalyticsAutomationResult } from './types';
import { googleServiceFactory } from '@/lib/google/googleServiceFactory';

function lastDayOfMonth(dateStr: string): string {
  const d = new Date(dateStr);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

function prevMonthRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const end = new Date(d.getFullYear(), d.getMonth(), 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Minimal shape of a GA4 runReport row we care about (one date range). */
export interface GA4Row {
  dimensionValues?: ({ value?: string | null } | null)[] | null;
  metricValues?: ({ value?: string | null } | null)[] | null;
}

export interface TrafficTotals {
  totalUsers: number;
  totalSessions: number;
  /** Average bounce rate as a percentage (0–100), session-weighted. */
  avgBounceRate: number;
  topPage: string;
  topPageSessions: number;
}

/**
 * Aggregate GA4 rows for a SINGLE date range. Each row is one pagePath with
 * metrics [totalUsers, sessions, bounceRate]. GA4 returns bounceRate as a 0–1
 * ratio, so we convert to a percentage.
 *
 * The previous implementation requested two date ranges in one call. GA4 then
 * auto-adds a `dateRange` dimension and returns a row per (page, range), but
 * the old loop summed every row's metrics together — double-counting current +
 * previous into one inflated visitor number, and the trend never computed
 * because the previous total was never read. Aggregating one range at a time
 * keeps the headline numbers honest.
 */
export function aggregateTraffic(rows: GA4Row[]): TrafficTotals {
  let totalUsers = 0;
  let totalSessions = 0;
  let weightedBounce = 0;
  let topPage = '/';
  let topPageSessions = 0;

  for (const row of rows) {
    const m = row.metricValues || [];
    const users = parseInt(m[0]?.value || '0', 10) || 0;
    const sessions = parseInt(m[1]?.value || '0', 10) || 0;
    const bounce = parseFloat(m[2]?.value || '0') || 0;
    const pagePath = row.dimensionValues?.[0]?.value || '/';

    totalUsers += users;
    totalSessions += sessions;
    weightedBounce += bounce * sessions;

    if (sessions > topPageSessions) {
      topPageSessions = sessions;
      topPage = pagePath;
    }
  }

  const avgBounceRate = totalSessions > 0
    ? (weightedBounce / totalSessions) * 100
    : 0;

  return { totalUsers, totalSessions, avgBounceRate, topPage, topPageSessions };
}

export async function checkAnalytics(
  ga4PropertyId: string,
  reportMonth: string,
  formSubmissionCount: number,
): Promise<AnalyticsAutomationResult> {
  const items = blankItems('analytics');
  const notes: string[] = [];
  const recommendations: string[] = [];
  const status: SectionStatus = 'healthy';

  const fallbackMetrics = {
    totalVisitors: '',
    topPage: '',
    formSubmissions: String(formSubmissionCount || ''),
    bounceRate: '',
  };

  try {
    const analyticsData = await googleServiceFactory.getAnalyticsDataClient();
    if (!analyticsData) {
      notes.push('Google Analytics not configured — enter metrics manually');
      return { items, status: 'unknown', notes: notes.join('. '), recommendations, analyticsMetrics: fallbackMetrics };
    }

    const startDate = reportMonth;
    const endDate = lastDayOfMonth(reportMonth);
    const prev = prevMonthRange(reportMonth);

    const baseRequest = {
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'bounceRate' },
      ],
      dimensions: [{ name: 'pagePath' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 25,
    };

    // Two single-range reports so current and previous never get mixed.
    const [curResp, prevResp] = await Promise.all([
      analyticsData.properties.runReport({
        property: `properties/${ga4PropertyId}`,
        requestBody: { ...baseRequest, dateRanges: [{ startDate, endDate }] },
      }),
      analyticsData.properties.runReport({
        property: `properties/${ga4PropertyId}`,
        requestBody: { ...baseRequest, dateRanges: [{ startDate: prev.start, endDate: prev.end }] },
      }),
    ]);

    const current = aggregateTraffic((curResp.data.rows as GA4Row[]) || []);
    const previous = aggregateTraffic((prevResp.data.rows as GA4Row[]) || []);

    markItem(items, 'traffic', 'pass', `${current.totalUsers.toLocaleString()} visitors`);
    markItem(items, 'topPages', 'pass', current.topPage);

    notes.push(`${current.totalUsers.toLocaleString()} visitors, ${current.totalSessions.toLocaleString()} sessions`);
    notes.push(`Top page: ${current.topPage} (${current.topPageSessions} sessions)`);
    notes.push(`Bounce rate: ${current.avgBounceRate.toFixed(1)}%`);

    if (previous.totalUsers > 0) {
      const changePct = Math.round(((current.totalUsers - previous.totalUsers) / previous.totalUsers) * 100);
      const direction = changePct >= 0 ? 'up' : 'down';
      markItem(items, 'trend', 'pass', `${direction} ${Math.abs(changePct)}% MoM`);
      notes.push(`Traffic ${direction} ${Math.abs(changePct)}% vs previous month`);
    } else {
      // No prior-month baseline to compare against — honestly leave pending.
      markItem(items, 'trend', 'pending', 'no prior-month baseline');
    }

    return {
      items,
      status,
      notes: notes.join('. '),
      recommendations,
      analyticsMetrics: {
        totalVisitors: String(current.totalUsers),
        topPage: current.topPage,
        formSubmissions: String(formSubmissionCount || 0),
        bounceRate: `${current.avgBounceRate.toFixed(1)}%`,
      },
    };
  } catch (e: any) {
    notes.push(`GA4 error: ${e.message}. Enter metrics manually.`);
    return { items, status: 'unknown', notes: notes.join('. '), recommendations, analyticsMetrics: fallbackMetrics };
  }
}
