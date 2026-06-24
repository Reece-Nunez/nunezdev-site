import { blankItems, markItem, type SectionStatus } from './sections';
import type { FormsAutomationResult } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function checkForms(
  reportMonth: string,
  orgId: string,
  supabase: SupabaseClient,
): Promise<FormsAutomationResult> {
  const items = blankItems('forms');
  const notes: string[] = [];
  const status: SectionStatus = 'healthy';

  // Count form submissions (leads) for the report month.
  try {
    const startDate = reportMonth; // e.g., "2026-02-01"
    const start = new Date(reportMonth);
    const endDate = new Date(start.getFullYear(), start.getMonth() + 1, 1)
      .toISOString()
      .slice(0, 10);

    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    const formCount = count || 0;
    markItem(items, 'count', 'pass', `${formCount} this month`);
    notes.push(`${formCount} form submission${formCount !== 1 ? 's' : ''} received this month`);

    return { items, status, notes: notes.join('. '), formSubmissionCount: formCount };
  } catch {
    // Could not query — leave the count item pending rather than reporting 0 as fact.
    notes.push('Could not query form submissions');
    return { items, status: 'unknown', notes: notes.join('. '), formSubmissionCount: 0 };
  }
}
