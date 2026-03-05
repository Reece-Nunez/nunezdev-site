import type { SectionStatus } from '@/lib/pdf-templates/client-report';
import type { FormsAutomationResult } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function checkForms(
  reportMonth: string,
  orgId: string,
  supabase: SupabaseClient,
): Promise<FormsAutomationResult> {
  // Items: [test inquiry, email delivery, spam filter, form errors] — all manual
  const items = [false, false, false, false];
  const notes: string[] = [];
  const status: SectionStatus = 'healthy';

  // Count form submissions (leads) for the report month
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
    notes.push(`${formCount} form submission${formCount !== 1 ? 's' : ''} received this month`);

    return { items, status, notes: notes.join('. '), formSubmissionCount: formCount };
  } catch {
    notes.push('Could not query form submissions');
    return { items, status, notes: notes.join('. '), formSubmissionCount: 0 };
  }
}
