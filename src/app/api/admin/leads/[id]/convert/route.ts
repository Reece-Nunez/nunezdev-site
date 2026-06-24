import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireProspecting } from '@/lib/authz';

// Convert a lead into a client. Creates a fresh row in `clients`, links the
// lead to it via leads.client_id, and marks the lead as 'converted'. Idempotent:
// if the lead already has a client_id, returns that existing client instead
// of creating a duplicate.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireProspecting();
  if (!guard.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id: leadId } = await context.params;
  const orgId = guard.orgId;
  const supabase = supabaseAdmin();

  // Load the lead so we have the data to seed the client record.
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Idempotency: already converted? Just return the existing link.
  if (lead.client_id) {
    return NextResponse.json({
      lead,
      clientId: lead.client_id,
      alreadyConverted: true,
    });
  }

  // Optional overrides from the dashboard (e.g. user edited the name before
  // converting). Falls back to lead fields.
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const overrides = body && typeof body === 'object' ? body : {};

  const clientInsert = {
    org_id: orgId,
    name: (overrides as { name?: string }).name?.trim() || lead.name || 'New client',
    email: (overrides as { email?: string }).email?.trim() || lead.email || null,
    phone: (overrides as { phone?: string }).phone?.trim() || lead.phone || null,
    company: (overrides as { company?: string }).company?.trim() || lead.company || null,
    status: 'Active', // Convert action implies they accepted the offer.
    tags: Array.isArray(lead.tags) && lead.tags.length ? lead.tags : null,
  };

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .insert(clientInsert)
    .select('id')
    .single();

  if (clientErr || !client) {
    return NextResponse.json(
      { error: clientErr?.message || 'Failed to create client' },
      { status: 500 }
    );
  }

  // Link the lead to the new client and mark converted.
  const { error: linkErr } = await supabase
    .from('leads')
    .update({
      client_id: client.id,
      status: 'converted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (linkErr) {
    // Don't roll back the client — better to have a client without a link
    // than to silently lose the conversion. Just surface the error.
    return NextResponse.json(
      { error: `Client created but link failed: ${linkErr.message}`, clientId: client.id },
      { status: 500 }
    );
  }

  return NextResponse.json({ clientId: client.id, alreadyConverted: false });
}
