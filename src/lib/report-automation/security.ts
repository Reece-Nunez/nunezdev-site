import type { SectionStatus } from '@/lib/pdf-templates/client-report';
import type { AutomationSectionResult } from './types';

export async function checkSecurity(websiteUrl: string): Promise<AutomationSectionResult> {
  // Items: [npm audit, updated deps, framework security, spam protection, exposed env vars]
  const items = [false, false, false, false, false];
  const notes: string[] = [];
  let status: SectionStatus = 'healthy';

  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'NunezDev-ReportBot/1.0' },
    });

    // Check security headers
    const headers = res.headers;
    const securityHeaders: Record<string, boolean> = {
      'x-frame-options': headers.has('x-frame-options'),
      'content-security-policy': headers.has('content-security-policy'),
      'strict-transport-security': headers.has('strict-transport-security'),
      'x-content-type-options': headers.has('x-content-type-options'),
    };

    const present = Object.entries(securityHeaders).filter(([, v]) => v).map(([k]) => k);
    const missing = Object.entries(securityHeaders).filter(([, v]) => !v).map(([k]) => k);

    if (missing.length > 0) {
      notes.push(`Missing security headers: ${missing.join(', ')}`);
      if (missing.length >= 3) status = 'attention';
    }
    if (present.length > 0) {
      notes.push(`Security headers present: ${present.join(', ')}`);
    }
  } catch (e: any) {
    notes.push(`Could not check security headers: ${e.message}`);
  }

  // Check for exposed .env file
  try {
    const envRes = await fetch(`${websiteUrl.replace(/\/$/, '')}/.env`, {
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    if (envRes.ok) {
      const text = await envRes.text();
      if (text.includes('=') && text.length < 50000) {
        notes.push('WARNING: .env file appears to be publicly accessible!');
        status = 'issue';
      } else {
        items[4] = true;
      }
    } else {
      items[4] = true; // .env not exposed (404 or similar)
    }
  } catch {
    items[4] = true; // Error means it's not accessible
  }

  return { items, status, notes: notes.join('. ') };
}
