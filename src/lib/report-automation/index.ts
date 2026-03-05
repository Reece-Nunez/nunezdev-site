import { checkSiteHealth } from './siteHealth';
import { checkPerformance } from './performance';
import { checkSecurity } from './security';
import { checkSEO } from './seo';
import { checkForms } from './forms';
import { checkAnalytics } from './analytics';
import { checkContent } from './content';
import { checkHosting } from './hosting';
import type {
  AutomationResult,
  AutomationSectionResult,
  PerformanceAutomationResult,
  AnalyticsAutomationResult,
  FormsAutomationResult,
} from './types';
import type { SectionStatus } from '@/lib/pdf-templates/client-report';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AutomationInput {
  websiteUrl: string;
  ga4PropertyId: string | null;
  vercelProjectId: string | null;
  reportMonth: string;
  supabase: SupabaseClient;
}

function fallbackSection(itemCount: number): AutomationSectionResult {
  return {
    items: Array(itemCount).fill(false),
    status: 'healthy',
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

function computeOverallStatus(sections: AutomationSectionResult[]): string {
  const statuses = sections.map(s => s.status);
  if (statuses.includes('issue')) return 'Needs Attention';
  if (statuses.includes('attention')) return 'Good';
  return 'Excellent';
}

function generateRecommendations(result: Omit<AutomationResult, 'overallStatus' | 'recommendations'>): string[] {
  const recs: string[] = [];

  // Check performance scores
  const dScore = parseInt(result.performance.perfMetrics.desktop.score);
  const mScore = parseInt(result.performance.perfMetrics.mobile.score);
  if (!isNaN(mScore) && mScore < 70) {
    recs.push(`Mobile performance score is ${mScore} — consider optimizing images, reducing JavaScript, and improving server response times.`);
  }
  if (!isNaN(dScore) && dScore < 70) {
    recs.push(`Desktop performance score is ${dScore} — run a full Lighthouse audit to identify specific optimization opportunities.`);
  }

  // Check SSL
  if (result.siteHealth.notes.includes('expires in') && result.siteHealth.notes.includes('days')) {
    const match = result.siteHealth.notes.match(/expires in (\d+) days/);
    if (match && parseInt(match[1]) < 30) {
      recs.push(`SSL certificate expires in ${match[1]} days — ensure auto-renewal is configured.`);
    }
  }

  // Check security headers
  if (result.security.notes.includes('Missing security headers')) {
    recs.push('Add missing security headers (Content-Security-Policy, Strict-Transport-Security) to improve site security.');
  }

  // Check SEO
  if (result.seo.notes.includes('No sitemap.xml')) {
    recs.push('Create and submit a sitemap.xml to improve search engine indexing.');
  }
  if (result.seo.notes.includes('Missing OG tags')) {
    recs.push('Add Open Graph meta tags to improve social media sharing previews.');
  }

  // Check broken links
  if (result.seo.notes.includes('broken link')) {
    recs.push('Fix broken links found on the homepage to improve user experience and SEO.');
  }

  // Check content
  if (result.content.notes.includes('broken image')) {
    recs.push('Fix broken images on the site to ensure all visual content loads properly.');
  }
  if (result.content.notes.includes('placeholder content')) {
    recs.push('Review and replace placeholder content found on the site.');
  }

  // Check hosting
  if (result.hosting.notes.includes('failed deployment')) {
    recs.push('Investigate recent failed deployments and resolve build issues.');
  }

  // Exposed .env
  if (result.security.notes.includes('.env file appears to be publicly accessible')) {
    recs.push('URGENT: .env file is publicly accessible — configure your hosting to block access to sensitive files immediately.');
  }

  return recs.slice(0, 3);
}

export async function runAllAutomation(input: AutomationInput): Promise<AutomationResult> {
  const { websiteUrl, ga4PropertyId, vercelProjectId, reportMonth, supabase } = input;

  // Run all checks in parallel
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
    checkForms(reportMonth, supabase),
    checkContent(websiteUrl),
    vercelProjectId
      ? checkHosting(vercelProjectId)
      : Promise.resolve(fallbackSection(4) as AutomationSectionResult),
  ]);

  const siteHealth = unwrap(siteHealthResult, fallbackSection(5));
  const performance = unwrap(performanceResult, {
    ...fallbackSection(4),
    perfMetrics: {
      desktop: { score: '', lcp: '', cls: '', inp: '' },
      mobile: { score: '', lcp: '', cls: '', inp: '' },
    },
  } as PerformanceAutomationResult);
  const security = unwrap(securityResult, fallbackSection(5));
  const seo = unwrap(seoResult, fallbackSection(5));
  const forms = unwrap(formsResult, {
    ...fallbackSection(4),
    formSubmissionCount: 0,
  } as FormsAutomationResult);
  const content = unwrap(contentResult, fallbackSection(3));
  const hosting = unwrap(hostingResult, fallbackSection(4));

  // Run analytics after forms (needs formSubmissionCount)
  let analytics: AnalyticsAutomationResult;
  if (ga4PropertyId) {
    try {
      analytics = await checkAnalytics(ga4PropertyId, reportMonth, forms.formSubmissionCount);
    } catch {
      analytics = {
        ...fallbackSection(3),
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
      ...fallbackSection(3),
      analyticsMetrics: {
        totalVisitors: '',
        topPage: '',
        formSubmissions: String(forms.formSubmissionCount || ''),
        bounceRate: '',
      },
      notes: 'GA4 property not configured — enter analytics metrics manually',
    };
  }

  const sections = { siteHealth, performance, security, seo, forms, analytics, content, hosting };
  const allSections = Object.values(sections);
  const overallStatus = computeOverallStatus(allSections);
  const recommendations = generateRecommendations(sections);

  return {
    ...sections,
    overallStatus,
    recommendations,
  };
}
