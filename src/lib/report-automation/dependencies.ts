/**
 * Dependency vulnerability check via GitHub Dependabot Alerts.
 *
 * Replaces the manual "npm audit" step: instead of cloning the repo and running
 * npm, we read the repo's open Dependabot alerts over the REST API. GitHub
 * already runs the audit continuously, so this is both cheaper and always
 * current. Requires a read-only GITHUB_TOKEN (scope: security_events, or
 * repo-level "Dependabot alerts: read") and a `github_repo` ("owner/name") on
 * the site.
 *
 * The interpretation (severity → pass/fail + recommendation) is pure and
 * unit-tested; the fetch is a thin shell that no-ops without a token/repo, the
 * same way the hosting and performance checks degrade.
 */

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface DependabotSummary {
  critical: number;
  high: number;
  moderate: number; // GitHub's "medium", labelled to match npm audit wording
  low: number;
  total: number;
}

/** Minimal shape of a Dependabot alert we read the severity from. */
export interface DependabotAlert {
  security_advisory?: { severity?: string | null } | null;
  security_vulnerability?: { severity?: string | null } | null;
}

/** Count open alerts by severity. Unknown severities are ignored, not summed. */
export function summarizeAlerts(alerts: DependabotAlert[]): DependabotSummary {
  const summary: DependabotSummary = { critical: 0, high: 0, moderate: 0, low: 0, total: 0 };
  for (const a of alerts) {
    const raw = (a.security_advisory?.severity ?? a.security_vulnerability?.severity ?? '').toLowerCase();
    switch (raw) {
      case 'critical': summary.critical++; summary.total++; break;
      case 'high': summary.high++; summary.total++; break;
      case 'medium': summary.moderate++; summary.total++; break;
      case 'low': summary.low++; summary.total++; break;
      default: break; // unknown / null severity — don't count toward a verdict
    }
  }
  return summary;
}

export interface DependencyVerdict {
  outcome: 'pass' | 'fail';
  detail: string;
  recommendation?: string;
}

/**
 * Turn a severity summary into a pass/fail verdict. Critical or high alerts
 * fail the check (they need action); moderate/low are surfaced but don't flip
 * the section red, matching how the security header check treats minor gaps.
 */
export function dependencyVerdict(summary: DependabotSummary): DependencyVerdict {
  if (summary.critical > 0 || summary.high > 0) {
    const parts = [
      summary.critical ? `${summary.critical} critical` : null,
      summary.high ? `${summary.high} high` : null,
    ].filter(Boolean);
    return {
      outcome: 'fail',
      detail: `${parts.join(', ')} severity`,
      recommendation: `Update dependencies flagged by Dependabot — ${parts.join(' and ')} vulnerabilit${summary.critical + summary.high === 1 ? 'y' : 'ies'} need patching.`,
    };
  }
  if (summary.total > 0) {
    const parts = [
      summary.moderate ? `${summary.moderate} moderate` : null,
      summary.low ? `${summary.low} low` : null,
    ].filter(Boolean);
    return { outcome: 'pass', detail: `${parts.join(', ')} (no critical/high)` };
  }
  return { outcome: 'pass', detail: 'no known vulnerabilities' };
}

export interface DependabotFetchResult {
  ok: boolean;
  alerts?: DependabotAlert[];
  error?: string;
}

/**
 * Fetch a repo's OPEN Dependabot alerts. Returns ok:false (never throws) when
 * the token is missing or GitHub errors, so the caller can leave the item
 * pending rather than claim a pass. `repo` is "owner/name".
 */
export async function fetchDependabotAlerts(repo: string): Promise<DependabotFetchResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: 'GITHUB_TOKEN not configured' };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/dependabot/alerts?state=open&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'NunezDev-ReportBot/1.0',
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) {
      // 403 usually means Dependabot alerts are disabled or the token lacks the
      // scope; 404 means the repo/name is wrong. Surface the status either way.
      return { ok: false, error: `GitHub API ${res.status}` };
    }
    const alerts = (await res.json()) as DependabotAlert[];
    return { ok: true, alerts: Array.isArray(alerts) ? alerts : [] };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
