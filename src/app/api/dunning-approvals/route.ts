import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pending shutdown-tier SMS approvals for the owner's org. Powers the dashboard
 * approval banner. Owner-only; scoped by org_id in code (service-role client).
 */
export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('pending_sms_approvals')
    .select('id, invoice_id, client_name, invoice_number, amount_cents, days_overdue, body, created_at')
    .eq('org_id', guard.orgId!)
    .eq('status', 'pending')
    .order('days_overdue', { ascending: false });

  if (error) {
    console.error('[dunning-approvals] list failed:', error.message);
    return NextResponse.json({ error: 'Failed to load approvals' }, { status: 500 });
  }

  return NextResponse.json({ approvals: data ?? [] });
}
