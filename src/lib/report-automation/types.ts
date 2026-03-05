import type { SectionStatus } from '@/lib/pdf-templates/client-report';

export interface AutomationSectionResult {
  items: boolean[];
  status: SectionStatus;
  notes: string;
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
