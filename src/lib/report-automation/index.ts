import { checkSiteHealth } from './siteHealth';
import { checkPerformance } from './performance';
import { checkSecurity } from './security';
import { checkSEO } from './seo';
import { checkForms } from './forms';
import { checkAnalytics } from './analytics';
import { checkContent } from './content';
import { checkHosting } from './hosting';
import { checkSearchConsole, type SearchConsoleResult } from './searchConsole';
import {
  fetchSitemapUrls,
  loadPreviousSnapshot,
  saveSnapshot,
  computeGscTrend,
  computeSitemapDiff,
} from './snapshots';
import { blankItems, markItem, SECTION_DEFS, type SectionKey, type SectionStatus } from './sections';
import { buildExecutiveSummary } from './summary';
import type {
  AutomationResult,
  AutomationSectionResult,
  PerformanceAutomationResult,
  AnalyticsAutomationResult,
  FormsAutomationResult,
  ReportTier,
} from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AutomationInput {
  websiteUrl: string;
  ga4PropertyId: string | null;
  vercelProjectId: string | null;
  gscSiteUrl?: string | null;
  githubRepo?: string | null;
  reportMonth: string;
  orgId: string;
  /** Site being reported on; enables month-over-month snapshots. Null for legacy client-level reports. */
  siteId?: string | null;
  supabase: SupabaseClient;
  /** Resolved report tier (Essential/Growth/Premium) for this client. */
  tier: ReportTier;
  /** Normalized monthly recurring amount (cents) that set the tier. */
  monthlyAmountCents: number;
}

/**
 * When a check could not run, return a section whose auto items are left
 * `pending` and whose status is `unknown` — NOT `healthy`. A failed check must
 * never render as a green "all good" badge to the client.
 */
function fallbackSection(key: SectionKey): AutomationSectionResult {
  return {
    items: blankItems(key),
    status: 'unknown',
    notes: 'Automated check unavailable — verify manually',
  };
}

function unwrap<T extends AutomationSectionResult>(
  result: PromiseSettledResult<T>,
  fallback: T,
): T {
  if (result.status === 'fulfilled') return result.value;
  return fallback;
}

/**
 * Ensure the website URL has a scheme so `fetch` / `new URL()` can parse it.
 * Operators enter URLs inconsistently ("www.gogoldman.com", "gogoldman.com",
 * "https://…"); a scheme-less value made every check throw "Failed to parse
 * URL". Defaults to https.
 */
export function normalizeWebsiteUrl(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Roll section statuses up to a headline. `unknown` (a check that could not
 * run) is treated as "not fully verified" so it can't inflate the report to
 * "Excellent".
 */
export function computeOverallStatus(statuses: SectionStatus[]): string {
  if (statuses.includes('issue')) return 'Needs Attention';
  if (statuses.includes('attention') || statuses.includes('unknown')) return 'Good';
  return 'Excellent';
}

export async function runAllAutomation(input: AutomationInput): Promise<AutomationResult> {
  const { ga4PropertyId, vercelProjectId, gscSiteUrl, githubRepo, reportMonth, orgId, supabase, tier, monthlyAmountCents } = input;
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl);

  const [
    siteHealthResult,
    performanceResult,
    securityResult,
    seoResult,
    formsResult,
    contentResult,
    hostingResult,
  ] = await Promise.allSettled([
    checkSiteHealth(websiteUrl),
    checkPerformance(websiteUrl),
    checkSecurity(websiteUrl, githubRepo),
    checkSEO(websiteUrl),
    checkForms(reportMonth, orgId, supabase),
    checkContent(websiteUrl),
    vercelProjectId
      ? checkHosting(vercelProjectId)
      : Promise.resolve(fallbackSection('hosting')),
  ]);

  const siteHealth = unwrap(siteHealthResult, fallbackSection('siteHealth'));
  const performance = unwrap(performanceResult, {
    ...fallbackSection('performance'),
    perfMetrics: {
      desktop: { score: '', lcp: '', cls: '', inp: '' },
      mobile: { score: '', lcp: '', cls: '', inp: '' },
    },
  } as PerformanceAutomationResult);
  const security = unwrap(securityResult, fallbackSection('security'));
  const seo = unwrap(seoResult, fallbackSection('seo'));
  const forms = unwrap(formsResult, {
    ...fallbackSection('forms'),
    formSubmissionCount: 0,
  } as FormsAutomationResult);
  const content = unwrap(contentResult, fallbackSection('content'));
  const hosting = unwrap(hostingResult, fallbackSection('hosting'));

  // Analytics runs after forms (it needs the form-submission count).
  let analytics: AnalyticsAutomationResult;
  if (ga4PropertyId) {
    try {
      analytics = await checkAnalytics(ga4PropertyId, reportMonth, forms.formSubmissionCount);
    } catch {
      analytics = {
        ...fallbackSection('analytics'),
        analyticsMetrics: {
          totalVisitors: '',
          topPage: '',
          formSubmissions: String(forms.formSubmissionCount || ''),
          bounceRate: '',
        },
      };
    }
  } else {
    analytics = {
      ...fallbackSection('analytics'),
      notes: 'GA4 property not configured — enter analytics metrics manually',
      analyticsMetrics: {
        totalVisitors: '',
        topPage: '',
        formSubmissions: String(forms.formSubmissionCount || ''),
        bounceRate: '',
      },
    };
  }

  // Enrich the SEO section with real Search Console performance when the client
  // has a GSC site configured. Flips the otherwise-manual "Search Console
  // reviewed" item to a verified pass with the month's clicks/impressions.
  let sc: SearchConsoleResult | null = null;
  if (gscSiteUrl) {
    try {
      sc = await checkSearchConsole(gscSiteUrl, reportMonth);
      if (sc.configured && sc.detail) {
        markItem(seo.items, 'searchConsole', 'pass', sc.detail);
        seo.notes = seo.notes ? `${seo.notes}. ${sc.note}` : (sc.note ?? '');
      }
    } catch {
      // Non-fatal — leave the manual Search Console item as-is.
    }
  }

  // Month-over-month insights: store this month's GSC totals + sitemap, and
  // compare against last month's snapshot to surface an SEO trend and any new
  // pages. Only runs for site-scoped reports; enriches notes without changing
  // any item's auto/manual kind. Entirely best-effort — never fails the run.
  if (input.siteId) {
    try {
      const sitemapUrls = await fetchSitemapUrls(websiteUrl);
      const previous = await loadPreviousSnapshot(supabase, input.siteId, reportMonth);

      if (previous) {
        if (sc?.configured && sc.clicks != null && previous.gscClicks != null) {
          const trend = computeGscTrend(
            { clicks: sc.clicks, impressions: sc.impressions ?? 0 },
            { clicks: previous.gscClicks, impressions: previous.gscImpressions ?? 0 },
          );
          if (trend.note) seo.notes = seo.notes ? `${seo.notes}. ${trend.note}` : trend.note;
          if (trend.recommendation) (seo.recommendations ??= []).push(trend.recommendation);
        }

        if (previous.sitemapUrls.length > 0 && sitemapUrls.length > 0) {
          const diff = computeSitemapDiff(sitemapUrls, previous.sitemapUrls);
          if (diff.added.length > 0) {
            const sample = diff.added.slice(0, 3).map(u => { try { return new URL(u).pathname; } catch { return u; } });
            const suffix = diff.added.length > sample.length ? '…' : '';
            content.notes = content.notes
              ? `${content.notes}. ${diff.note}: ${sample.join(', ')}${suffix}`
              : `${diff.note}: ${sample.join(', ')}${suffix}`;
          }
        }
      }

      await saveSnapshot(supabase, {
        orgId,
        siteId: input.siteId,
        reportMonth,
        snapshot: {
          gscClicks: sc?.clicks ?? null,
          gscImpressions: sc?.impressions ?? null,
          sitemapUrls,
        },
      });
    } catch {
      // Snapshots are a nice-to-have — never let them break the report.
    }
  }

  const sections = { siteHealth, performance, security, seo, forms, analytics, content, hosting };
  const allSections = Object.values(sections);

  const overallStatus = computeOverallStatus(allSections.map(s => s.status));

  // Recommendations are collected from what each check actually found, in
  // priority order (most urgent sections first). No more string-matching the
  // free-text notes, which used to recommend "fix broken links" off the word
  // "links" in a clean result.
  const recommendations = [
    ...security.recommendations ?? [],
    ...siteHealth.recommendations ?? [],
    ...hosting.recommendations ?? [],
    ...performance.recommendations ?? [],
    ...seo.recommendations ?? [],
    ...content.recommendations ?? [],
    ...analytics.recommendations ?? [],
  ].slice(0, 5);

  const executiveSummary = buildExecutiveSummary(
    tier,
    overallStatus,
    SECTION_DEFS.map(d => ({ title: d.title, status: sections[d.key].status })),
    recommendations,
  );

  return {
    ...sections,
    overallStatus,
    recommendations,
    tier,
    monthlyAmountCents,
    executiveSummary,
  };
}
