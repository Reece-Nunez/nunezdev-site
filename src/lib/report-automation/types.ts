import type { CheckItem, SectionStatus } from './sections';

export type { CheckItem, SectionStatus, ItemKind, ItemOutcome } from './sections';

export interface AutomationSectionResult {
  items: CheckItem[];
  status: SectionStatus;
  notes: string;
  /**
   * Human-readable, already-actionable recommendations this section wants to
   * surface (e.g. "Mobile performance score is 54 — optimize images"). The
   * orchestrator collects these instead of re-deriving them by string-matching
   * the free-text `notes`, which used to fire false positives.
   */
  recommendations?: string[];
}

export interface PerformanceAutomationResult extends AutomationSectionResult {
  perfMetrics: {
    desktop: { score: string; lcp: string; cls: string; inp: string };
    mobile: { score: string; lcp: string; cls: string; inp: string };
  };
}

export interface AnalyticsAutomationResult extends AutomationSectionResult {
  analyticsMetrics: {
    totalVisitors: string;
    topPage: string;
    formSubmissions: string;
    bounceRate: string;
  };
}

export interface FormsAutomationResult extends AutomationSectionResult {
  formSubmissionCount: number;
}

export interface AutomationResult {
  siteHealth: AutomationSectionResult;
  performance: PerformanceAutomationResult;
  security: AutomationSectionResult;
  seo: AutomationSectionResult;
  forms: FormsAutomationResult;
  analytics: AnalyticsAutomationResult;
  content: AutomationSectionResult;
  hosting: AutomationSectionResult;
  overallStatus: string;
  recommendations: string[];
}
