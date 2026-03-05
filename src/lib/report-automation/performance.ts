import type { SectionStatus } from '@/lib/pdf-templates/client-report';
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

    // LCP in seconds
    const lcpMs = audits['largest-contentful-paint']?.numericValue;
    const lcp = lcpMs != null ? `${(lcpMs / 1000).toFixed(1)}s` : '-';

    // CLS (unitless)
    const clsVal = audits['cumulative-layout-shift']?.numericValue;
    const cls = clsVal != null ? clsVal.toFixed(3) : '-';

    // INP in ms
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
  // Items: [Lighthouse audit, Core Web Vitals, Images optimized, Page load times]
  const items = [false, false, false, false];
  const notes: string[] = [];
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
    items[0] = true; // Lighthouse audit ran

    // Check if we got CWV values
    const hasCWV = (desktopMetrics?.lcp !== '-' || mobileMetrics?.lcp !== '-');
    if (hasCWV) items[1] = true;

    // Determine status from scores
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
  } else {
    notes.push('PageSpeed Insights API unavailable — run Lighthouse manually');
  }

  return { items, status, notes: notes.join('. '), perfMetrics };
}
