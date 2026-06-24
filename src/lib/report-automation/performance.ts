import { blankItems, markItem, type SectionStatus } from './sections';
import type { PerformanceAutomationResult } from './types';

const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

interface PSIMetrics {
  score: string;
  lcp: string;
  cls: string;
  inp: string;
}

async function runPSI(url: string, strategy: 'desktop' | 'mobile'): Promise<PSIMetrics | null> {
  try {
    const apiKey = process.env.PAGESPEED_API_KEY || '';
    const params = new URLSearchParams({
      url,
      strategy: strategy.toUpperCase(),
      category: 'performance',
    });
    if (apiKey) params.set('key', apiKey);

    const res = await fetch(`${PSI_API}?${params}`, {
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const lighthouse = data.lighthouseResult;
    if (!lighthouse) return null;

    const perfScore = lighthouse.categories?.performance?.score;
    const audits = lighthouse.audits || {};

    const lcpMs = audits['largest-contentful-paint']?.numericValue;
    const lcp = lcpMs != null ? `${(lcpMs / 1000).toFixed(1)}s` : '-';

    const clsVal = audits['cumulative-layout-shift']?.numericValue;
    const cls = clsVal != null ? clsVal.toFixed(3) : '-';

    const inpMs = audits['interaction-to-next-paint']?.numericValue
      ?? audits['experimental-interaction-to-next-paint']?.numericValue;
    const inp = inpMs != null ? `${Math.round(inpMs)}ms` : '-';

    return {
      score: perfScore != null ? `${Math.round(perfScore * 100)}` : '-',
      lcp,
      cls,
      inp,
    };
  } catch {
    return null;
  }
}

export async function checkPerformance(websiteUrl: string): Promise<PerformanceAutomationResult> {
  const items = blankItems('performance');
  const notes: string[] = [];
  const recommendations: string[] = [];
  let status: SectionStatus = 'healthy';

  const [desktop, mobile] = await Promise.allSettled([
    runPSI(websiteUrl, 'desktop'),
    runPSI(websiteUrl, 'mobile'),
  ]);

  const desktopMetrics = desktop.status === 'fulfilled' ? desktop.value : null;
  const mobileMetrics = mobile.status === 'fulfilled' ? mobile.value : null;

  const perfMetrics = {
    desktop: desktopMetrics || { score: '', lcp: '', cls: '', inp: '' },
    mobile: mobileMetrics || { score: '', lcp: '', cls: '', inp: '' },
  };

  if (desktopMetrics || mobileMetrics) {
    markItem(
      items,
      'lighthouse',
      'pass',
      `Desktop ${desktopMetrics?.score || 'N/A'} / Mobile ${mobileMetrics?.score || 'N/A'}`,
    );

    const hasCWV = (desktopMetrics?.lcp !== '-' || mobileMetrics?.lcp !== '-');
    if (hasCWV) {
      const cwvDetail = `LCP ${mobileMetrics?.lcp ?? desktopMetrics?.lcp}`;
      markItem(items, 'cwv', 'pass', cwvDetail);
    } else {
      markItem(items, 'cwv', 'fail', 'no field/lab CWV data');
    }

    const dScore = desktopMetrics ? parseInt(desktopMetrics.score) : NaN;
    const mScore = mobileMetrics ? parseInt(mobileMetrics.score) : NaN;
    const minScore = Math.min(
      isNaN(dScore) ? 100 : dScore,
      isNaN(mScore) ? 100 : mScore,
    );

    if (minScore >= 90) {
      status = 'healthy';
      notes.push(`Performance scores: Desktop ${desktopMetrics?.score || 'N/A'}, Mobile ${mobileMetrics?.score || 'N/A'}`);
    } else if (minScore >= 50) {
      status = 'attention';
      notes.push(`Performance needs improvement: Desktop ${desktopMetrics?.score || 'N/A'}, Mobile ${mobileMetrics?.score || 'N/A'}`);
    } else {
      status = 'issue';
      notes.push(`Low performance scores: Desktop ${desktopMetrics?.score || 'N/A'}, Mobile ${mobileMetrics?.score || 'N/A'}`);
    }

    if (!isNaN(mScore) && mScore < 70) {
      recommendations.push(`Mobile performance score is ${mScore} — optimize images, reduce JavaScript, and improve server response times.`);
    }
    if (!isNaN(dScore) && dScore < 70) {
      recommendations.push(`Desktop performance score is ${dScore} — run a full Lighthouse audit to find specific wins.`);
    }
  } else {
    // PSI unavailable — auto items stay pending; surface the uncertainty.
    notes.push('PageSpeed Insights API unavailable — run Lighthouse manually');
    status = 'unknown';
  }

  return { items, status, notes: notes.join('. '), recommendations, perfMetrics };
}
