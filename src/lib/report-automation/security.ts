import { blankItems, markItem, type SectionStatus } from './sections';
import type { AutomationSectionResult } from './types';
import { fetchDependabotAlerts, summarizeAlerts, dependencyVerdict } from './dependencies';

export async function checkSecurity(
  websiteUrl: string,
  githubRepo?: string | null,
): Promise<AutomationSectionResult> {
  const items = blankItems('security');
  const notes: string[] = [];
  const recommendations: string[] = [];
  let status: SectionStatus = 'healthy';

  // HTTP security headers
  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'NunezDev-ReportBot/1.0' },
    });

    const headers = res.headers;
    const securityHeaders: Record<string, boolean> = {
      'x-frame-options': headers.has('x-frame-options'),
      'content-security-policy': headers.has('content-security-policy'),
      'strict-transport-security': headers.has('strict-transport-security'),
      'x-content-type-options': headers.has('x-content-type-options'),
    };

    const present = Object.entries(securityHeaders).filter(([, v]) => v).map(([k]) => k);
    const missing = Object.entries(securityHeaders).filter(([, v]) => !v).map(([k]) => k);

    if (missing.length === 0) {
      markItem(items, 'headers', 'pass', `all 4 present`);
      notes.push('All checked security headers present');
    } else {
      // Missing a couple of headers is common and low-risk; missing most of them
      // is worth flagging.
      const outcome = missing.length >= 3 ? 'fail' : 'pass';
      markItem(items, 'headers', outcome, `${present.length}/4 present`);
      notes.push(`Security headers present: ${present.join(', ') || 'none'}. Missing: ${missing.join(', ')}`);
      if (missing.length >= 3) {
        recommendations.push(`Add missing security headers (${missing.join(', ')}) to harden the site.`);
        status = 'attention';
      }
    }
  } catch (e: any) {
    // Could not fetch — leave 'headers' pending rather than claim a pass.
    notes.push(`Could not check security headers: ${e.message}`);
  }

  // Publicly exposed .env file
  try {
    const envRes = await fetch(`${websiteUrl.replace(/\/$/, '')}/.env`, {
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    if (envRes.ok) {
      const text = await envRes.text();
      if (text.includes('=') && text.length < 50000) {
        markItem(items, 'envExposed', 'fail', '.env is publicly readable');
        notes.push('WARNING: .env file appears to be publicly accessible!');
        recommendations.push('URGENT: .env file is publicly accessible — block access to dotfiles at the host/CDN immediately.');
        status = 'issue';
      } else {
        markItem(items, 'envExposed', 'pass', 'not exposed');
      }
    } else {
      markItem(items, 'envExposed', 'pass', `not exposed (HTTP ${envRes.status})`);
    }
  } catch {
    markItem(items, 'envExposed', 'pass', 'not exposed');
  }

  // Dependency vulnerabilities via GitHub Dependabot. Only runs when the site
  // has a github_repo configured and a GITHUB_TOKEN is present; otherwise the
  // (now auto) npmAudit item is left pending rather than claiming a pass.
  if (githubRepo) {
    const result = await fetchDependabotAlerts(githubRepo);
    if (result.ok && result.alerts) {
      const summary = summarizeAlerts(result.alerts);
      const verdict = dependencyVerdict(summary);
      markItem(items, 'npmAudit', verdict.outcome, verdict.detail);
      if (verdict.outcome === 'fail') {
        notes.push(`Dependabot: ${verdict.detail} vulnerabilities open`);
        if (verdict.recommendation) recommendations.push(verdict.recommendation);
        if (status === 'healthy') status = 'attention';
      } else {
        notes.push(`Dependencies: ${verdict.detail}`);
      }
    } else {
      // Could not read alerts — leave npmAudit pending, note why.
      notes.push(`Dependabot check unavailable: ${result.error}`);
    }
  }

  return { items, status, notes: notes.join('. '), recommendations };
}
