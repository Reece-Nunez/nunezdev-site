import { checkSiteHealth } from './siteHealth';
import { checkPerformance } from './performance';
import { checkSecurity } from './security';
import { checkSEO } from './seo';
import { checkForms } from './forms';
import { checkAnalytics } from './analytics';
import { checkContent } from './content';
import { checkHosting } from './hosting';
import { checkSearchConsole } from './searchConsole';
import { blankItems, markItem, type SectionKey, type SectionStatus } from './sections';
import type {
  AutomationResult,
  AutomationSectionResult,
  PerformanceAutomationResult,
  AnalyticsAutomationResult,
  FormsAutomationResult,
} from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AutomationInput {
  websiteUrl: string;
  ga4PropertyId: string | null;
  vercelProjectId: string | null;
  gscSiteUrl?: string | null;
  reportMonth: string;
  orgId: string;
  supabase: SupabaseClient;
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
  const { websiteUrl, ga4PropertyId, vercelProjectId, gscSiteUrl, reportMonth, orgId, supabase } = input;

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
    checkSecurity(websiteUrl),
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
  if (gscSiteUrl) {
    try {
      const sc = await checkSearchConsole(gscSiteUrl, reportMonth);
      if (sc.configured && sc.detail) {
        markItem(seo.items, 'searchConsole', 'pass', sc.detail);
        seo.notes = seo.notes ? `${seo.notes}. ${sc.note}` : (sc.note ?? '');
      }
    } catch {
      // Non-fatal — leave the manual Search Console item as-is.
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

  return {
    ...sections,
    overallStatus,
    recommendations,
  };
}
