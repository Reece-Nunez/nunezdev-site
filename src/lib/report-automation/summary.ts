/**
 * Executive summary — the plain-English "big picture" paragraph at the top of
 * the report. This is where the tiers visibly diverge: an Essential report
 * states posture and what needs attention (a maintenance summary), while Growth
 * and Premium layer on priorities and a forward-looking, partnership tone that
 * justify the higher retainer.
 *
 * Pure and unit-tested — it reads only the already-computed section statuses,
 * overall status, and ranked recommendations.
 */

import type { SectionStatus } from './sections';
import type { ReportTier } from './tier';

export interface SectionSummary {
  title: string;
  status: SectionStatus;
}

export function buildExecutiveSummary(
  tier: ReportTier,
  overallStatus: string,
  sections: SectionSummary[],
  topRecommendations: string[],
): string {
  const flagged = sections.filter(s => s.status === 'issue' || s.status === 'attention');
  const unknown = sections.filter(s => s.status === 'unknown');

  const parts: string[] = [];
  parts.push(`This month your site is in ${overallStatus.toLowerCase()} overall health.`);

  if (flagged.length === 0) {
    parts.push('Every automated check that ran passed cleanly.');
  } else {
    const names = flagged.map(s => s.title).join(', ');
    parts.push(`${flagged.length} area${flagged.length === 1 ? '' : 's'} need${flagged.length === 1 ? 's' : ''} attention: ${names}.`);
  }

  if (unknown.length > 0) {
    parts.push(`${unknown.length} area${unknown.length === 1 ? '' : 's'} couldn't be verified automatically and ${unknown.length === 1 ? 'was' : 'were'} reviewed by hand.`);
  }

  // Growth and Premium surface the single highest-priority action.
  if ((tier === 'growth' || tier === 'premium') && topRecommendations.length > 0) {
    parts.push(`Top priority: ${topRecommendations[0]}`);
  }

  // Premium adds a second priority (when there is one) and a partnership close
  // that matches the "monthly strategy" promise of the $500 plan.
  if (tier === 'premium') {
    if (topRecommendations.length > 1) {
      parts.push(`Also on our radar: ${topRecommendations[1]}`);
    }
    parts.push("We'll keep watching performance, security, and growth, and reach out proactively as opportunities come up.");
  }

  return parts.join(' ');
}
