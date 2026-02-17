// Debug API to check table contents
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/authz';

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  try {
    // Check clients
    const { data: clients, error: clientsErr } = await supabase
      .from('clients')
      .select('id, name, status, created_at')
      .eq('org_id', orgId);

    // Check invoices
    const { data: invoices, error: invoicesErr } = await supabase
      .from('invoices')
      .select('id, status, amount_cents, issued_at, created_at')
      .eq('org_id', orgId);

    return NextResponse.json({
      orgId,
      clients: {
        count: clients?.length ?? 0,
        data: clients,
        error: clientsErr?.message
      },
      invoices: {
        count: invoices?.length ?? 0,
        data: invoices,
        error: invoicesErr?.message
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error },
      { status: 500 }
    );
  }
}
