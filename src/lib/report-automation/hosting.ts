import { blankItems, markItem, type SectionStatus } from './sections';
import type { AutomationSectionResult } from './types';

const VERCEL_API = 'https://api.vercel.com';

export async function checkHosting(vercelProjectId: string): Promise<AutomationSectionResult> {
  const items = blankItems('hosting');
  const notes: string[] = [];
  const recommendations: string[] = [];
  let status: SectionStatus = 'healthy';

  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    // No token — we can't verify anything; don't pretend we did.
    notes.push('Vercel API token not configured — check builds manually');
    return { items, status: 'unknown', notes: notes.join('. '), recommendations };
  }

  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const teamId = process.env.VERCEL_TEAM_ID;
    const teamParam = teamId ? `&teamId=${teamId}` : '';

    const res = await fetch(
      `${VERCEL_API}/v6/deployments?projectId=${vercelProjectId}&limit=5&target=production${teamParam}`,
      { headers, signal: AbortSignal.timeout(10000) },
    );

    if (!res.ok) {
      const errText = await res.text();
      notes.push(`Vercel API error: ${res.status}. ${errText}`);
      return { items, status: 'unknown', notes: notes.join('. '), recommendations };
    }

    const data = await res.json();
    const deployments = data.deployments || [];

    if (deployments.length === 0) {
      notes.push('No recent production deployments found');
      return { items, status: 'unknown', notes: notes.join('. '), recommendations };
    }

    const latest = deployments[0];
    const latestState = latest.state || latest.readyState;

    if (latestState === 'READY') {
      const deployDate = new Date(latest.created).toLocaleDateString();
      markItem(items, 'deploy', 'pass', `succeeded ${deployDate}`);
      notes.push(`Latest deployment successful (${deployDate})`);
    } else {
      markItem(items, 'deploy', 'fail', `state: ${latestState}`);
      notes.push(`Latest deployment state: ${latestState}`);
      recommendations.push('Latest production deployment is not in a READY state — investigate the build.');
      status = 'issue';
    }

    const failedCount = deployments.filter(
      (d: any) => (d.state || d.readyState) === 'ERROR'
    ).length;

    if (failedCount === 0) {
      markItem(items, 'failedDeploys', 'pass', `${deployments.length} clean`);
      notes.push(`No failed deployments in recent history (${deployments.length} checked)`);
    } else {
      markItem(items, 'failedDeploys', 'fail', `${failedCount} failed`);
      notes.push(`${failedCount} failed deployment${failedCount > 1 ? 's' : ''} in recent history`);
      recommendations.push('Investigate recent failed deployments and resolve the build errors.');
      if (status === 'healthy') status = 'attention';
    }

    // Domain configuration
    try {
      const domainRes = await fetch(
        `${VERCEL_API}/v9/projects/${vercelProjectId}/domains${teamParam ? `?${teamParam.slice(1)}` : ''}`,
        { headers, signal: AbortSignal.timeout(5000) },
      );
      if (domainRes.ok) {
        const domainData = await domainRes.json();
        const domains = domainData.domains || [];
        const misconfigured = domains.filter((d: any) => d.verified === false);
        if (domains.length > 0 && misconfigured.length === 0) {
          markItem(items, 'domains', 'pass', `${domains.length} verified`);
          notes.push(`${domains.length} domain${domains.length > 1 ? 's' : ''} configured and verified`);
        } else if (misconfigured.length > 0) {
          markItem(items, 'domains', 'fail', `${misconfigured.length} unverified`);
          notes.push(`${misconfigured.length} domain${misconfigured.length > 1 ? 's' : ''} not verified`);
          recommendations.push('Verify the misconfigured domain(s) in Vercel so DNS resolves correctly.');
          if (status === 'healthy') status = 'attention';
        }
        // domains.length === 0 → leave 'domains' pending (nothing to verify).
      }
    } catch { /* non-critical — leave 'domains' pending */ }
  } catch (e: any) {
    notes.push(`Vercel API check failed: ${e.message}`);
    return { items, status: 'unknown', notes: notes.join('. '), recommendations };
  }

  return { items, status, notes: notes.join('. '), recommendations };
}
