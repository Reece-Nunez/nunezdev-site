import * as fs from 'fs';
import * as path from 'path';

// NunezDev Brand Colors
const BRAND_YELLOW = '#ffc312';
const BRAND_DARK = '#1a1a2e';

export type SectionStatus = 'healthy' | 'attention' | 'issue';

export interface ChecklistItem {
  label: string;
  checked: boolean;
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
  sections: {
    siteHealth: ReportSection;
    performance: ReportSection & { metrics: PerformanceMetrics };
    security: ReportSection;
    seo: ReportSection;
    forms: ReportSection;
    analytics: ReportSection & { metrics: AnalyticsMetrics };
    content: ReportSection;
    hosting: ReportSection;
  };
  recommendations: string[];
  overallStatus: string; // "Excellent" | "Good" | "Needs Attention"
  hoursSpent: string;
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
  return '<span style="color: #ef4444; font-size: 16px;">&#10007;</span>';
}

function statusColor(status: SectionStatus): string {
  if (status === 'healthy') return '#10b981';
  if (status === 'attention') return '#f59e0b';
  return '#ef4444';
}

function statusLabel(status: SectionStatus): string {
  if (status === 'healthy') return 'Healthy';
  if (status === 'attention') return 'Attention';
  return 'Issue';
}

function renderChecklist(items: ChecklistItem[]): string {
  return items.map(item => `
    <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px;">
      <span style="color: ${item.checked ? '#10b981' : '#d1d5db'}; font-size: 14px;">${item.checked ? '&#9745;' : '&#9744;'}</span>
      <span style="color: ${item.checked ? '#374151' : '#9ca3af'};">${item.label}</span>
    </div>
  `).join('');
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
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px;">
        ${renderChecklist(section.items)}
      </div>
      ${extraContent || ''}
      ${section.notes ? `
        <div style="margin-top: 12px; padding: 10px 14px; background: #f9fafb; border-left: 3px solid ${BRAND_YELLOW}; border-radius: 0 6px 6px 0; font-size: 12px; color: #4b5563;">
          <strong style="color: ${BRAND_DARK};">Notes:</strong> ${section.notes}
        </div>
      ` : ''}
    </div>
  `;
}

export function generateClientReportHTML(data: ClientReportData): string {
  const { client, reportMonth, sections, recommendations, overallStatus, hoursSpent } = data;
  const logoBase64 = getLogoBase64();
  const monthLabel = formatMonth(reportMonth);
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const performanceTable = `
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

  const analyticsTable = `
    <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Total Visitors</div>
        <div style="font-size: 18px; font-weight: 700; color: ${BRAND_DARK};">${sections.analytics.metrics.totalVisitors || '-'}</div>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Top Page</div>
        <div style="font-size: 13px; font-weight: 600; color: ${BRAND_DARK};">${sections.analytics.metrics.topPage || '-'}</div>
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

  const summaryRows = [
    { label: 'Site Health & Uptime', status: sections.siteHealth.status },
    { label: 'Performance', status: sections.performance.status },
    { label: 'Security', status: sections.security.status },
    { label: 'SEO', status: sections.seo.status },
    { label: 'Forms & Lead Gen', status: sections.forms.status },
    { label: 'Content', status: sections.content.status },
    { label: 'Hosting', status: sections.hosting.status },
  ];

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
      <div style="font-size: 18px; font-weight: 700; color: ${BRAND_DARK};">${client.name}</div>
      ${client.company ? `<div style="font-size: 13px; color: #6b7280; margin-top: 2px;">${client.company}</div>` : ''}
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
    </div>

    <!-- Sections -->
    ${renderSection('Site Health & Uptime', sections.siteHealth)}
    ${renderSection('Performance', sections.performance, performanceTable)}
    ${renderSection('Security & Dependencies', sections.security)}
    ${renderSection('SEO & Discoverability', sections.seo)}

    <div class="page-break"></div>

    ${renderSection('Forms & Lead Generation', sections.forms)}
    ${renderSection('Analytics Overview', sections.analytics, analyticsTable)}
    ${renderSection('Content & Gallery', sections.content)}
    ${renderSection('Hosting & Infrastructure', sections.hosting)}

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
            <span style="font-size: 12px; color: #374151; line-height: 1.6; padding-top: 2px;">${rec}</span>
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
