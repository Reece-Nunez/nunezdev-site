import * as fs from 'fs';
import * as path from 'path';

// NunezDev Brand Colors
const BRAND_YELLOW = '#ffc312';
const BRAND_DARK = '#1a1a2e';

export interface TaxInvoiceSummary {
  invoiceNumber: string;
  issuedAt: string;
  amountCents: number;
  status: string;
  totalPaidCents: number;
}

export interface TaxDocumentData {
  client: {
    id: string;
    name: string;
    company?: string | null;
    email?: string | null;
  };
  year: number;
  invoices: TaxInvoiceSummary[];
  totals: {
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
  };
}

function formatCurrency(cents: number): string {
  const v = Math.max(0, Number(cents ?? 0)) / 100;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    partially_paid: 'Partial',
    overdue: 'Overdue',
    void: 'Void'
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    paid: '#10b981',
    partially_paid: '#f59e0b',
    sent: '#3b82f6',
    overdue: '#ef4444',
    draft: '#6b7280',
    void: '#9ca3af'
  };
  return colors[status] || '#6b7280';
}

function getLogoBase64(): string {
  try {
    // Try to load logo from public directory
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

export function generateTaxSummaryHTML(data: TaxDocumentData): string {
  const { client, year, invoices, totals } = data;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const logoBase64 = getLogoBase64();

  const invoiceRows = invoices.map(inv => `
    <tr>
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">${inv.invoiceNumber}</td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">${formatDate(inv.issuedAt)}</td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatCurrency(inv.amountCents)}</td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; background-color: ${getStatusColor(inv.status)}20; color: ${getStatusColor(inv.status)};">
          ${getStatusLabel(inv.status)}
        </span>
      </td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500; color: #10b981;">${formatCurrency(inv.totalPaidCents)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Annual Invoice Summary - ${year}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      color: #374151;
      line-height: 1.6;
      background: #ffffff;
    }
    .container {
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 3px solid ${BRAND_YELLOW};
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .logo {
      height: 60px;
      width: auto;
    }
    .company-info {
      text-align: right;
    }
    .company-name {
      font-size: 14px;
      font-weight: 600;
      color: ${BRAND_DARK};
    }
    .company-contact {
      font-size: 11px;
      color: #6b7280;
      margin-top: 4px;
    }
    .document-title {
      text-align: center;
      margin-bottom: 32px;
    }
    .document-title h1 {
      font-size: 28px;
      font-weight: 700;
      color: ${BRAND_DARK};
      margin-bottom: 4px;
    }
    .document-title .year-badge {
      display: inline-block;
      background: ${BRAND_YELLOW};
      color: ${BRAND_DARK};
      font-size: 18px;
      font-weight: 700;
      padding: 6px 20px;
      border-radius: 20px;
      margin-top: 8px;
    }
    .client-section {
      background: linear-gradient(135deg, #f8f9fa 0%, #f0f1f3 100%);
      border-left: 4px solid ${BRAND_YELLOW};
      padding: 20px 24px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 32px;
    }
    .client-section h2 {
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .client-name {
      font-size: 18px;
      font-weight: 700;
      color: ${BRAND_DARK};
    }
    .client-detail {
      font-size: 13px;
      color: #6b7280;
      margin-top: 2px;
    }
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 32px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .invoice-table th {
      background: ${BRAND_DARK};
      color: #ffffff;
      padding: 14px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .invoice-table th.right {
      text-align: right;
    }
    .invoice-table th.center {
      text-align: center;
    }
    .invoice-table tbody tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .invoice-table tbody tr:hover {
      background-color: #fef9e7;
    }
    .summary-section {
      background: linear-gradient(135deg, ${BRAND_DARK} 0%, #2d2d44 100%);
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 32px;
      color: #ffffff;
    }
    .summary-grid {
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }
    .summary-item {
      flex: 1;
      text-align: center;
      padding: 16px;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
    }
    .summary-item.highlight {
      background: ${BRAND_YELLOW};
      color: ${BRAND_DARK};
    }
    .summary-label {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.9;
      margin-bottom: 6px;
    }
    .summary-item.highlight .summary-label {
      opacity: 0.8;
    }
    .summary-value {
      font-size: 22px;
      font-weight: 700;
    }
    .footer {
      text-align: center;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      color: #9ca3af;
      font-size: 11px;
      margin-bottom: 4px;
    }
    .footer .generated {
      color: #6b7280;
    }
    .no-invoices {
      text-align: center;
      padding: 60px 40px;
      color: #6b7280;
      font-size: 16px;
      background: #f9fafb;
      border-radius: 12px;
      margin-bottom: 32px;
    }
    .watermark {
      position: fixed;
      bottom: 20px;
      right: 40px;
      font-size: 10px;
      color: #d1d5db;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-section">
        ${logoBase64 ? `<img src="${logoBase64}" alt="NunezDev" class="logo" />` : '<div class="company-name" style="font-size: 24px; color: ' + BRAND_YELLOW + ';">NunezDev</div>'}
      </div>
      <div class="company-info">
        <div class="company-name">NunezDev LLC</div>
        <div class="company-contact">Web Development & Design</div>
        <div class="company-contact">contact@nunezdev.com</div>
      </div>
    </div>

    <div class="document-title">
      <h1>Annual Invoice Summary</h1>
      <span class="year-badge">${year}</span>
    </div>

    <div class="client-section">
      <h2>Prepared For</h2>
      <div class="client-name">${client.name}</div>
      ${client.company ? `<div class="client-detail">${client.company}</div>` : ''}
      ${client.email ? `<div class="client-detail">${client.email}</div>` : ''}
    </div>

    ${invoices.length > 0 ? `
    <table class="invoice-table">
      <thead>
        <tr>
          <th>Invoice #</th>
          <th>Date Issued</th>
          <th class="right">Amount</th>
          <th class="center">Status</th>
          <th class="right">Paid</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceRows}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">Total Invoiced</div>
          <div class="summary-value">${formatCurrency(totals.totalInvoiced)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Total Paid</div>
          <div class="summary-value">${formatCurrency(totals.totalPaid)}</div>
        </div>
        <div class="summary-item highlight">
          <div class="summary-label">Balance Due</div>
          <div class="summary-value">${formatCurrency(totals.balanceDue)}</div>
        </div>
      </div>
    </div>
    ` : `
    <div class="no-invoices">
      No invoices found for ${year}
    </div>
    `}

    <div class="footer">
      <p class="generated">Generated on ${generatedDate}</p>
      <p>This document is provided for tax and record-keeping purposes.</p>
    </div>
  </div>

  <div class="watermark">NunezDev LLC</div>
</body>
</html>
`;
}
