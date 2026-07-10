import * as fs from 'fs';
import * as path from 'path';
import type { SectionStatus, ItemKind, ItemOutcome } from '@/lib/report-automation/sections';

// NunezDev Brand Colors
const BRAND_YELLOW = '#ffc312';
const BRAND_DARK = '#1a1a2e';

export type { SectionStatus, ItemKind, ItemOutcome };

export interface ChecklistItem {
  label: string;
  /** Kept for backward-compat with reports saved before outcome/detail existed. */
  checked: boolean;
  kind?: ItemKind;
  outcome?: ItemOutcome;
  /** Measured value or reason, e.g. "HTTP 200", "expires in 320 days". */
  detail?: string;
}

/** Old reports only stored {label, checked}; derive a 3-state outcome from it. */
function itemOutcome(item: ChecklistItem): ItemOutcome {
  if (item.outcome) return item.outcome;
  return item.checked ? 'pass' : 'pending';
}

/**
 * Escape text pulled from the live site (page titles, notes, URLs) before
 * embedding it in the report HTML, so a stray `&`/`<` can't break layout or
 * inject markup.
 */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ReportSection {
  items: ChecklistItem[];
  notes: string;
  status: SectionStatus;
}

export interface PerformanceMetrics {
  desktop: { score: string; lcp: string; cls: string; inp: string };
  mobile: { score: string; lcp: string; cls: string; inp: string };
  lastMonth?: {
    desktop: { score: string; lcp: string; cls: string; inp: string };
    mobile: { score: string; lcp: string; cls: string; inp: string };
  };
}

export interface AnalyticsMetrics {
  totalVisitors: string;
  topPage: string;
  formSubmissions: string;
  bounceRate: string;
}

export interface ClientReportData {
  client: {
    name: string;
    company?: string | null;
    email?: string | null;
  };
  reportMonth: string; // ISO date string for the first of the month
  site?: { label?: string | null; websiteUrl?: string | null } | null;
  // Sections are optional: lower tiers omit the ones their plan doesn't
  // include (e.g. Essential has no SEO/Analytics section). Every render path
  // guards for absence.
  sections: Partial<{
    siteHealth: ReportSection;
    performance: ReportSection & { metrics: PerformanceMetrics };
    security: ReportSection;
    seo: ReportSection;
    forms: ReportSection;
    analytics: ReportSection & { metrics: AnalyticsMetrics };
    content: ReportSection;
    hosting: ReportSection;
  }>;
  recommendations: string[];
  overallStatus: string; // "Excellent" | "Good" | "Needs Attention"
  hoursSpent: string;
  executiveSummary?: string; // tier-aware "big picture" paragraph
}

function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
  } catch (e) {
    console.error('Failed to load logo:', e);
  }
  return '';
}

function formatMonth(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function statusIcon(status: SectionStatus): string {
  if (status === 'healthy') return '<span style="color: #10b981; font-size: 16px;">&#10003;</span>';
  if (status === 'attention') return '<span style="color: #f59e0b; font-size: 16px;">&#9888;</span>';
  if (status === 'unknown') return '<span style="color: #9ca3af; font-size: 16px;">&#9711;</span>';
  return '<span style="color: #ef4444; font-size: 16px;">&#10007;</span>';
}

function statusColor(status: SectionStatus): string {
  if (status === 'healthy') return '#10b981';
  if (status === 'attention') return '#f59e0b';
  if (status === 'unknown') return '#9ca3af';
  return '#ef4444';
}

function statusLabel(status: SectionStatus): string {
  if (status === 'healthy') return 'Healthy';
  if (status === 'attention') return 'Attention';
  if (status === 'unknown') return 'Not Verified';
  return 'Issue';
}

const OUTCOME_STYLE: Record<ItemOutcome, { glyph: string; mark: string; label: string }> = {
  // mark = colour of the box/glyph; label = colour of the item text
  pass: { glyph: '&#9745;', mark: '#10b981', label: '#374151' },   // ☑ green
  fail: { glyph: '&#9746;', mark: '#ef4444', label: '#374151' },   // ☒ red
  pending: { glyph: '&#9744;', mark: '#d1d5db', label: '#9ca3af' }, // ☐ grey
};

function renderItem(item: ChecklistItem): string {
  const outcome = itemOutcome(item);
  const s = OUTCOME_STYLE[outcome];
  const detail = item.detail
    ? `<span style="color: #9ca3af; font-size: 11px;"> — ${esc(item.detail)}</span>`
    : '';
  return `
    <div style="display: flex; align-items: baseline; gap: 8px; padding: 4px 0; font-size: 12px;">
      <span style="color: ${s.mark}; font-size: 14px; flex-shrink: 0;">${s.glyph}</span>
      <span style="color: ${s.label};">${esc(item.label)}${detail}</span>
    </div>
  `;
}

/**
 * Render a section's checklist, separating what the system actually measured
 * (`auto`) from what a person verified (`manual`). Items saved before this
 * split (no `kind`) are treated as automated so old reports still render.
 */
function renderChecklist(items: ChecklistItem[]): string {
  const auto = items.filter(i => i.kind !== 'manual');
  const manual = items.filter(i => i.kind === 'manual');

  const grid = (list: ChecklistItem[]) => `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px;">
      ${list.map(renderItem).join('')}
    </div>
  `;

  const groupLabel = (text: string) => `
    <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin: 8px 0 2px;">${text}</div>
  `;

  let out = '';
  if (auto.length) out += groupLabel('Automated checks') + grid(auto);
  if (manual.length) out += groupLabel('Manual verification') + grid(manual);
  return out;
}

function renderSection(title: string, section: ReportSection, extraContent?: string): string {
  return `
    <div style="margin-bottom: 28px; page-break-inside: avoid;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${BRAND_YELLOW};">
        <h2 style="font-size: 16px; font-weight: 700; color: ${BRAND_DARK}; margin: 0;">${title}</h2>
        <span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${statusColor(section.status)}15; color: ${statusColor(section.status)}; border: 1px solid ${statusColor(section.status)}30;">
          ${statusIcon(section.status)} ${statusLabel(section.status)}
        </span>
      </div>
      ${renderChecklist(section.items)}
      ${extraContent || ''}
      ${section.notes ? `
        <div style="margin-top: 12px; padding: 10px 14px; background: #f9fafb; border-left: 3px solid ${BRAND_YELLOW}; border-radius: 0 6px 6px 0; font-size: 12px; color: #4b5563;">
          <strong style="color: ${BRAND_DARK};">Notes:</strong> ${esc(section.notes)}
        </div>
      ` : ''}
    </div>
  `;
}

export function generateClientReportHTML(data: ClientReportData): string {
  const { client, reportMonth, sections, recommendations, overallStatus, hoursSpent, executiveSummary } = data;
  const logoBase64 = getLogoBase64();
  const monthLabel = formatMonth(reportMonth);
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const performanceTable = !sections.performance ? '' : `
    <div style="margin-top: 12px; overflow: hidden; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr>
            <th style="background: ${BRAND_DARK}; color: #fff; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Metric</th>
            <th style="background: ${BRAND_DARK}; color: #fff; padding: 10px 8px; text-align: center; font-size: 10px; text-transform: uppercase;">Desktop</th>
            <th style="background: ${BRAND_DARK}; color: #fff; padding: 10px 8px; text-align: center; font-size: 10px; text-transform: uppercase;">Mobile</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">Performance Score</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${sections.performance.metrics.desktop.score || '-'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${sections.performance.metrics.mobile.score || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">LCP (seconds)</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${sections.performance.metrics.desktop.lcp || '-'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${sections.performance.metrics.mobile.lcp || '-'}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">CLS</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${sections.performance.metrics.desktop.cls || '-'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${sections.performance.metrics.mobile.cls || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: 500;">INP (ms)</td>
            <td style="padding: 8px; text-align: center;">${sections.performance.metrics.desktop.inp || '-'}</td>
            <td style="padding: 8px; text-align: center;">${sections.performance.metrics.mobile.inp || '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const analyticsTable = !sections.analytics ? '' : `
    <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Total Visitors</div>
        <div style="font-size: 18px; font-weight: 700; color: ${BRAND_DARK};">${sections.analytics.metrics.totalVisitors || '-'}</div>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Top Page</div>
        <div style="font-size: 13px; font-weight: 600; color: ${BRAND_DARK};">${esc(sections.analytics.metrics.topPage) || '-'}</div>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Form Submissions</div>
        <div style="font-size: 18px; font-weight: 700; color: ${BRAND_DARK};">${sections.analytics.metrics.formSubmissions || '-'}</div>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Bounce Rate</div>
        <div style="font-size: 18px; font-weight: 700; color: ${BRAND_DARK};">${sections.analytics.metrics.bounceRate || '-'}</div>
      </div>
    </div>
  `;

  // Only summarize sections that are present for this tier.
  const summaryRows = ([
    ['siteHealth', 'Site Health & Uptime'],
    ['performance', 'Performance'],
    ['security', 'Security'],
    ['seo', 'SEO'],
    ['forms', 'Forms & Lead Gen'],
    ['analytics', 'Analytics'],
    ['content', 'Content'],
    ['hosting', 'Hosting'],
  ] as const).flatMap(([key, label]) => {
    const section = sections[key];
    return section ? [{ label: label as string, status: section.status }] : [];
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Report - ${monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      color: #374151;
      line-height: 1.6;
      background: #ffffff;
    }
    .container { padding: 36px 40px; max-width: 800px; margin: 0 auto; }
    @media print {
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid ${BRAND_YELLOW};">
      <div style="display: flex; align-items: center; gap: 16px;">
        ${logoBase64 ? `<img src="${logoBase64}" alt="NunezDev" style="height: 50px; width: auto;" />` : `<div style="font-size: 24px; font-weight: 700; color: ${BRAND_YELLOW};">NunezDev</div>`}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 14px; font-weight: 600; color: ${BRAND_DARK};">NunezDev LLC</div>
        <div style="font-size: 11px; color: #6b7280;">Technical Partner Report</div>
        <div style="font-size: 11px; color: #6b7280;">contact@nunezdev.com</div>
      </div>
    </div>

    <!-- Title -->
    <div style="text-align: center; margin-bottom: 28px;">
      <h1 style="font-size: 26px; font-weight: 700; color: ${BRAND_DARK}; margin-bottom: 6px;">Monthly Technical Report</h1>
      <span style="display: inline-block; background: ${BRAND_YELLOW}; color: ${BRAND_DARK}; font-size: 16px; font-weight: 700; padding: 5px 18px; border-radius: 20px;">${monthLabel}</span>
    </div>

    <!-- Client Info -->
    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #f0f1f3 100%); border-left: 4px solid ${BRAND_YELLOW}; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 28px;">
      <div style="font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Prepared For</div>
      <div style="font-size: 18px; font-weight: 700; color: ${BRAND_DARK};">${esc(client.name)}</div>
      ${client.company ? `<div style="font-size: 13px; color: #6b7280; margin-top: 2px;">${esc(client.company)}</div>` : ''}
      ${data.site?.label ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;"><strong style="color: ${BRAND_DARK};">Site:</strong> ${esc(data.site.label)}${data.site.websiteUrl ? ` — ${esc(data.site.websiteUrl)}` : ''}</div>` : ''}
    </div>

    <!-- Overall Summary Card -->
    <div style="background: linear-gradient(135deg, ${BRAND_DARK} 0%, #2d2d44 100%); padding: 20px 24px; border-radius: 12px; margin-bottom: 28px; color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; margin-bottom: 4px;">Overall Site Health</div>
          <div style="font-size: 24px; font-weight: 700;">${overallStatus}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; margin-bottom: 4px;">Hours This Month</div>
          <div style="font-size: 24px; font-weight: 700; color: ${BRAND_YELLOW};">${hoursSpent || '-'}</div>
        </div>
      </div>
      ${executiveSummary && executiveSummary.trim() ? `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.15); font-size: 13px; line-height: 1.6; opacity: 0.95;">
        ${esc(executiveSummary)}
      </div>
      ` : ''}
    </div>

    <!-- Sections (each rendered only when present for this tier) -->
    ${sections.siteHealth ? renderSection('Site Health & Uptime', sections.siteHealth) : ''}
    ${sections.performance ? renderSection('Performance', sections.performance, performanceTable) : ''}
    ${sections.security ? renderSection('Security & Dependencies', sections.security) : ''}
    ${sections.seo ? renderSection('SEO & Discoverability', sections.seo) : ''}

    <div class="page-break"></div>

    ${sections.forms ? renderSection('Forms & Lead Generation', sections.forms) : ''}
    ${sections.analytics ? renderSection('Analytics Overview', sections.analytics, analyticsTable) : ''}
    ${sections.content ? renderSection('Content & Gallery', sections.content) : ''}
    ${sections.hosting ? renderSection('Hosting & Infrastructure', sections.hosting) : ''}

    <!-- Recommendations -->
    ${recommendations.filter(r => r.trim()).length > 0 ? `
    <div style="margin-bottom: 28px; page-break-inside: avoid;">
      <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${BRAND_YELLOW};">
        <h2 style="font-size: 16px; font-weight: 700; color: ${BRAND_DARK}; margin: 0;">Recommendations & Next Steps</h2>
      </div>
      <div style="padding: 0;">
        ${recommendations.filter(r => r.trim()).map((rec, i) => `
          <div style="display: flex; gap: 12px; padding: 12px 14px; background: ${i % 2 === 0 ? '#f9fafb' : '#fff'}; border-radius: 6px; margin-bottom: 4px;">
            <span style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: ${BRAND_YELLOW}; color: ${BRAND_DARK}; font-weight: 700; font-size: 12px; flex-shrink: 0;">${i + 1}</span>
            <span style="font-size: 12px; color: #374151; line-height: 1.6; padding-top: 2px;">${esc(rec)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Summary Table -->
    <div style="margin-bottom: 28px; page-break-inside: avoid;">
      <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${BRAND_YELLOW};">
        <h2 style="font-size: 16px; font-weight: 700; color: ${BRAND_DARK}; margin: 0;">Summary</h2>
      </div>
      <div style="overflow: hidden; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="background: ${BRAND_DARK}; color: #fff; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Area</th>
              <th style="background: ${BRAND_DARK}; color: #fff; padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows.map((row, i) => `
              <tr style="background: ${i % 2 === 0 ? '#f9fafb' : '#fff'};">
                <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${row.label}</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                  <span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${statusColor(row.status)}15; color: ${statusColor(row.status)};">
                    ${statusIcon(row.status)} ${statusLabel(row.status)}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 11px; margin-bottom: 4px;">Generated on ${generatedDate}</p>
      <p style="color: #9ca3af; font-size: 11px;">Report delivered by NunezDev &mdash; Technical Partner</p>
    </div>
  </div>

  <div style="position: fixed; bottom: 20px; right: 40px; font-size: 10px; color: #d1d5db;">NunezDev LLC</div>
</body>
</html>
`;
}
