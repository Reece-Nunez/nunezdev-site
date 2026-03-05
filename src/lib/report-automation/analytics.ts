import type { SectionStatus } from '@/lib/pdf-templates/client-report';
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

export async function checkAnalytics(
  ga4PropertyId: string,
  reportMonth: string,
  formSubmissionCount: number,
): Promise<AnalyticsAutomationResult> {
  // Items: [traffic review, top pages, traffic trends]
  const items = [false, false, false];
  const notes: string[] = [];
  let status: SectionStatus = 'healthy';

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
      return { items, status, notes: notes.join('. '), analyticsMetrics: fallbackMetrics };
    }

    const startDate = reportMonth;
    const endDate = lastDayOfMonth(reportMonth);
    const prev = prevMonthRange(reportMonth);

    // Run report for current month
    const response = await analyticsData.properties.runReport({
      property: `properties/${ga4PropertyId}`,
      requestBody: {
        dateRanges: [
          { startDate, endDate, name: 'current' },
          { startDate: prev.start, endDate: prev.end, name: 'previous' },
        ],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'bounceRate' },
        ],
        dimensions: [{ name: 'pagePath' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      },
    });

    const rows = response.data.rows || [];

    // Aggregate totals for current month
    let totalUsers = 0;
    let totalSessions = 0;
    let weightedBounceRate = 0;
    let prevTotalUsers = 0;
    let topPage = '/';
    let topPageSessions = 0;

    for (const row of rows) {
      const metricValues = row.metricValues || [];
      const dateRangeIdx = row.dimensionValues?.[0]?.value === undefined ? 0 : undefined;

      // Current period metrics (dateRange index 0)
      const users = parseInt(metricValues[0]?.value || '0');
      const sessions = parseInt(metricValues[1]?.value || '0');
      const bounce = parseFloat(metricValues[2]?.value || '0');
      const pagePath = row.dimensionValues?.[0]?.value || '/';

      totalUsers += users;
      totalSessions += sessions;
      weightedBounceRate += bounce * sessions;

      if (sessions > topPageSessions) {
        topPageSessions = sessions;
        topPage = pagePath;
      }
    }

    const avgBounceRate = totalSessions > 0
      ? (weightedBounceRate / totalSessions * 100).toFixed(1)
      : '0';

    items[0] = true; // Reviewed traffic
    items[1] = true; // Identified top pages

    notes.push(`${totalUsers.toLocaleString()} visitors, ${totalSessions.toLocaleString()} sessions`);
    notes.push(`Top page: ${topPage} (${topPageSessions} sessions)`);
    notes.push(`Bounce rate: ${avgBounceRate}%`);

    // Check for trends (compare to previous month if we have data)
    if (prevTotalUsers > 0) {
      const change = ((totalUsers - prevTotalUsers) / prevTotalUsers * 100).toFixed(0);
      const direction = totalUsers >= prevTotalUsers ? 'up' : 'down';
      notes.push(`Traffic ${direction} ${Math.abs(parseInt(change))}% vs previous month`);
      items[2] = true;
    }

    return {
      items,
      status,
      notes: notes.join('. '),
      analyticsMetrics: {
        totalVisitors: String(totalUsers),
        topPage,
        formSubmissions: String(formSubmissionCount || 0),
        bounceRate: `${avgBounceRate}%`,
      },
    };
  } catch (e: any) {
    notes.push(`GA4 error: ${e.message}. Enter metrics manually.`);
    return { items, status: 'attention', notes: notes.join('. '), analyticsMetrics: fallbackMetrics };
  }
}
