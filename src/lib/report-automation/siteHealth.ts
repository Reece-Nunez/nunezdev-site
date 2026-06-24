import * as tls from 'tls';
import { blankItems, markItem, type SectionStatus } from './sections';
import type { AutomationSectionResult } from './types';

function checkSSL(hostname: string): Promise<{ valid: boolean; daysUntilExpiry: number; error?: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect(443, hostname, { servername: hostname }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert || !cert.valid_to) {
        resolve({ valid: false, daysUntilExpiry: 0, error: 'No certificate found' });
        return;
      }
      const expiryDate = new Date(cert.valid_to);
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / 86400000);
      resolve({ valid: daysUntilExpiry > 0, daysUntilExpiry });
    });
    socket.on('error', (err) => {
      resolve({ valid: false, daysUntilExpiry: 0, error: err.message });
    });
    socket.setTimeout(5000, () => {
      socket.destroy();
      resolve({ valid: false, daysUntilExpiry: 0, error: 'Connection timeout' });
    });
  });
}

export async function checkSiteHealth(websiteUrl: string): Promise<AutomationSectionResult> {
  const items = blankItems('siteHealth');
  const notes: string[] = [];
  const recommendations: string[] = [];
  let status: SectionStatus = 'healthy';

  // Live + responsive viewport (a meta tag, not a real device test — labelled honestly)
  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'NunezDev-ReportBot/1.0' },
    });
    if (res.ok) {
      markItem(items, 'live', 'pass', `HTTP ${res.status}`);
      const html = await res.text();

      if (/name=["']viewport["']/i.test(html)) {
        markItem(items, 'viewport', 'pass', 'viewport meta tag present');
      } else {
        markItem(items, 'viewport', 'fail', 'no viewport meta tag');
        notes.push('Missing viewport meta tag for mobile responsiveness');
        recommendations.push('Add a responsive viewport meta tag so the site scales correctly on phones.');
        status = 'attention';
      }
    } else {
      markItem(items, 'live', 'fail', `HTTP ${res.status}`);
      notes.push(`Site returned HTTP ${res.status}`);
      recommendations.push(`Homepage returned HTTP ${res.status} — investigate why the site is not serving a successful response.`);
      status = 'issue';
    }
  } catch (e: any) {
    markItem(items, 'live', 'fail', e.message);
    notes.push(`Site unreachable: ${e.message}`);
    recommendations.push('Homepage was unreachable during the check — confirm the site and DNS are up.');
    status = 'issue';
  }

  // SSL certificate
  try {
    const hostname = new URL(websiteUrl).hostname;
    const sslResult = await checkSSL(hostname);
    if (sslResult.valid) {
      markItem(items, 'ssl', 'pass', `expires in ${sslResult.daysUntilExpiry} days`);
      if (sslResult.daysUntilExpiry < 30) {
        notes.push(`SSL certificate expires in ${sslResult.daysUntilExpiry} days`);
        recommendations.push(`SSL certificate expires in ${sslResult.daysUntilExpiry} days — ensure auto-renewal is configured.`);
        if (status === 'healthy') status = 'attention';
      } else {
        notes.push(`SSL valid, expires in ${sslResult.daysUntilExpiry} days`);
      }
    } else {
      markItem(items, 'ssl', 'fail', sslResult.error || 'invalid certificate');
      notes.push(`SSL issue: ${sslResult.error}`);
      recommendations.push('SSL certificate is invalid or expired — renew it to keep the site trusted and secure.');
      status = 'issue';
    }
  } catch {
    // Leave SSL pending on unexpected error rather than claiming a result.
  }

  return { items, status, notes: notes.join('. '), recommendations };
}
