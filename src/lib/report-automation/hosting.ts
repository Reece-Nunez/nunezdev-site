import type { SectionStatus } from '@/lib/pdf-templates/client-report';
import type { AutomationSectionResult } from './types';

const VERCEL_API = 'https://api.vercel.com';

export async function checkHosting(vercelProjectId: string): Promise<AutomationSectionResult> {
  // Items: [builds deploying, build logs, hosting config, domain/DNS]
  const items = [false, false, false, false];
  const notes: string[] = [];
  let status: SectionStatus = 'healthy';

  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    notes.push('Vercel API token not configured — check builds manually');
    return { items, status: 'attention', notes: notes.join('. ') };
  }

  try {
    // List recent deployments
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
      return { items, status: 'attention', notes: notes.join('. ') };
    }

    const data = await res.json();
    const deployments = data.deployments || [];

    if (deployments.length === 0) {
      notes.push('No recent production deployments found');
      return { items, status: 'attention', notes: notes.join('. ') };
    }

    const latest = deployments[0];
    const latestState = latest.state || latest.readyState;

    // Check 1: Latest build deployed successfully
    if (latestState === 'READY') {
      items[0] = true;
      const deployDate = new Date(latest.created).toLocaleDateString();
      notes.push(`Latest deployment successful (${deployDate})`);
    } else {
      notes.push(`Latest deployment state: ${latestState}`);
      status = 'issue';
    }

    // Check 2: Review build logs for errors
    const failedCount = deployments.filter(
      (d: any) => (d.state || d.readyState) === 'ERROR'
    ).length;

    if (failedCount === 0) {
      items[1] = true;
      notes.push(`No failed deployments in recent history (${deployments.length} checked)`);
    } else {
      notes.push(`${failedCount} failed deployment${failedCount > 1 ? 's' : ''} in recent history`);
      if (status === 'healthy') status = 'attention';
    }

    // Check domain configuration
    try {
      const domainRes = await fetch(
        `${VERCEL_API}/v9/projects/${vercelProjectId}/domains${teamParam ? `?${teamParam.slice(1)}` : ''}`,
        { headers, signal: AbortSignal.timeout(5000) },
      );
      if (domainRes.ok) {
        const domainData = await domainRes.json();
        const domains = domainData.domains || [];
        const misconfigured = domains.filter((d: any) => d.verified === false);
        if (misconfigured.length === 0 && domains.length > 0) {
          items[3] = true;
          notes.push(`${domains.length} domain${domains.length > 1 ? 's' : ''} configured and verified`);
        } else if (misconfigured.length > 0) {
          notes.push(`${misconfigured.length} domain${misconfigured.length > 1 ? 's' : ''} not verified`);
          if (status === 'healthy') status = 'attention';
        }
      }
    } catch { /* non-critical */ }
  } catch (e: any) {
    notes.push(`Vercel API check failed: ${e.message}`);
    status = 'attention';
  }

  return { items, status, notes: notes.join('. ') };
}
