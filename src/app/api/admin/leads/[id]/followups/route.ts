import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireProspecting } from '@/lib/authz';
import { enrollLeadInSmsSequence, cancelLeadSmsSequence } from '@/lib/leadSmsSequence';

export const runtime = 'nodejs';

/** Current cadence status for the lead (for the detail-page card). */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireProspecting();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await context.params;
  const supabase = supabaseAdmin();
  const { data: rows } = await supabase
    .from('scheduled_sms')
    .select('step, body, scheduled_for, status, sent_at')
    .eq('lead_id', id)
    .order('step', { ascending: true });

  return NextResponse.json({ rows: rows ?? [] });
}

/** Start or stop the SMS follow-up cadence for a lead. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireProspecting();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await context.params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };

  if (action === 'start') {
    const result = await enrollLeadInSmsSequence(id);
    if (result.scheduled === 0) {
      const messages: Record<string, string> = {
        no_phone: 'This lead has no phone number to text.',
        opted_out: 'This lead opted out of texts (replied STOP).',
        terminal_status: 'This lead is already converted/qualified/lost.',
        already_enrolled: 'Follow-ups are already scheduled for this lead.',
        lead_not_found: 'Lead not found.',
      };
      return NextResponse.json(
        { ok: false, reason: result.reason, message: messages[result.reason ?? ''] ?? result.reason },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, scheduled: result.scheduled });
  }

  if (action === 'stop') {
    const cancelled = await cancelLeadSmsSequence(id, 'manual');
    return NextResponse.json({ ok: true, cancelled });
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}
