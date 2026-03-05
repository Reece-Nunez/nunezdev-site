import * as tls from 'tls';
import type { SectionStatus } from '@/lib/pdf-templates/client-report';
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
  // Items: [site live, pages load, mobile test, desktop test, SSL valid]
  const items = [false, false, false, false, false];
  const notes: string[] = [];
  let status: SectionStatus = 'healthy';

  // Check 1: Site is live + Check 3: Mobile viewport
  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'NunezDev-ReportBot/1.0' },
    });
    if (res.ok) {
      items[0] = true;
      const html = await res.text();

      // Check for mobile viewport meta tag
      if (/name=["']viewport["']/i.test(html)) {
        items[2] = true;
      } else {
        notes.push('Missing viewport meta tag for mobile responsiveness');
        status = 'attention';
      }
    } else {
      notes.push(`Site returned HTTP ${res.status}`);
      status = 'issue';
    }
  } catch (e: any) {
    notes.push(`Site unreachable: ${e.message}`);
    status = 'issue';
  }

  // Check 5: SSL certificate
  try {
    const hostname = new URL(websiteUrl).hostname;
    const sslResult = await checkSSL(hostname);
    if (sslResult.valid) {
      items[4] = true;
      if (sslResult.daysUntilExpiry < 30) {
        notes.push(`SSL certificate expires in ${sslResult.daysUntilExpiry} days`);
        if (status === 'healthy') status = 'attention';
      } else {
        notes.push(`SSL valid, expires in ${sslResult.daysUntilExpiry} days`);
      }
    } else {
      notes.push(`SSL issue: ${sslResult.error}`);
      status = 'issue';
    }
  } catch {
    // Leave SSL unchecked on error
  }

  return { items, status, notes: notes.join('. ') };
}
