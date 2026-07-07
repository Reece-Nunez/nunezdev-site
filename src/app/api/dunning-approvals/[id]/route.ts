import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendInvoiceReminderSms } from '@/lib/smsReminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolve a pending shutdown-tier SMS approval.
 *   POST /api/dunning-approvals/[id]  { action: 'approve' | 'dismiss' }
 *
 * approve -> send the frozen body via the SMS chokepoint, then mark approved.
 * dismiss -> mark dismissed, nothing sends.
 *
 * The message that goes out is exactly the `body` frozen at queue time, so what
 * the owner saw in the banner is what the client receives.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== 'approve' && action !== 'dismiss') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Load + authorize. Scope by org_id so an owner can only act on their own rows.
  const { data: row, error: loadErr } = await supabase
    .from('pending_sms_approvals')
    .select('id, org_id, invoice_id, client_id, body, status')
    .eq('id', id)
    .maybeSingle();

  if (loadErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.org_id !== guard.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (row.status !== 'pending') {
    // Someone already actioned it (or a double-click). Idempotent: report current state.
    return NextResponse.json({ ok: true, alreadyResolved: row.status });
  }

  const resolvedBy = guard.user!.email ?? guard.user!.id;
  const nowIso = new Date().toISOString();

  if (action === 'dismiss') {
    const { error } = await supabase
      .from('pending_sms_approvals')
      .update({ status: 'dismissed', resolved_at: nowIso, resolved_by: resolvedBy })
      .eq('id', id)
      .eq('status', 'pending'); // guard against a concurrent resolve
    if (error) return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'dismissed' });
  }

  // approve: send first, only mark approved if it actually went out.
  const result = await sendInvoiceReminderSms({
    invoiceId: row.invoice_id,
    clientId: row.client_id,
    reminderType: 'payment_overdue',
    body: row.body,
  });

  if (!result.ok) {
    // Quiet hours / opted out / already texted today, etc. Leave it pending so the
    // owner can retry later, and surface why.
    return NextResponse.json(
      { ok: false, reason: result.reason, detail: result.detail },
      { status: 409 },
    );
  }

  // The approved row (status + twilio_sid) is the shutdown audit record; the cron
  // dedupes on any pending_sms_approvals row for this invoice, so it won't re-queue.
  const { error: updErr } = await supabase
    .from('pending_sms_approvals')
    .update({ status: 'approved', resolved_at: nowIso, resolved_by: resolvedBy, twilio_sid: result.sid ?? null })
    .eq('id', id)
    .eq('status', 'pending');
  if (updErr) {
    console.error('[dunning-approvals] sent but failed to mark approved:', updErr.message);
  }

  return NextResponse.json({ ok: true, status: 'approved', sid: result.sid });
}
