import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireProspecting } from '@/lib/authz';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireProspecting();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await context.params;
  const supabase = supabaseAdmin();

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireProspecting();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await context.params;
  const updates = await request.json().catch(() => ({}));

  // Only allow a known set of fields to be updated from the dashboard so
  // an accidental PATCH can't trample lead_source / created_at / etc.
  const allowed = ['status', 'notes', 'next_followup', 'tags'] as const;
  const sanitized: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in updates) sanitized[key] = updates[key];
  }

  // When marking contacted/qualified, bump last_contact too.
  if (updates.status === 'contacted' || updates.status === 'qualified') {
    sanitized.last_contact = new Date().toISOString();
  }

  const supabase = supabaseAdmin();
  const { data: lead, error } = await supabase
    .from('leads')
    .update(sanitized)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ lead });
}

// Hard delete. For spam / test rows / accidental submissions only — for
// genuine "no thanks" outcomes prefer marking status='lost' so funnel
// analytics stay intact. scheduled_emails and lead_interactions cascade
// via FK ON DELETE CASCADE.
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireProspecting();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await context.params;
  const supabase = supabaseAdmin();

  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
