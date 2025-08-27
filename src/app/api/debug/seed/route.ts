// API to seed test data for KPIs
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/authz';

export async function POST() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = guard.orgId!;
  const supabase = await supabaseServer();

  try {
    // Get a client ID to link deals and invoices to
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .eq('org_id', orgId)
      .limit(1);
    
    const clientId = clients?.[0]?.id;
    if (!clientId) {
      return NextResponse.json({ error: 'No clients found. Add a client first.' }, { status: 400 });
    }

    // Add some sample deals
    const { data: dealsData, error: dealsError } = await supabase
      .from('deals')
      .insert([
        {
          org_id: orgId,
          client_id: clientId,
          title: 'Website Development',
          stage: 'Contract Sent',
          value_cents: 500000, // $5,000
          probability: 75
        },
        {
          org_id: orgId,
          client_id: clientId,
          title: 'Mobile App Development',
          stage: 'Negotiation', 
          value_cents: 1200000, // $12,000
          probability: 60
        },
        {
          org_id: orgId,
          client_id: clientId,
          title: 'E-commerce Platform',
          stage: 'Contacted',
          value_cents: 800000, // $8,000
          probability: 40
        }
      ])
      .select();

    if (dealsError) {
      return NextResponse.json({ error: 'Failed to create deals: ' + dealsError.message }, { status: 400 });
    }

    // Add some sample invoices
    const { data: invoicesData, error: invoicesError } = await supabase
      .from('invoices')
      .insert([
        {
          org_id: orgId,
          client_id: clientId,
          status: 'paid',
          amount_cents: 250000, // $2,500
          issued_at: new Date().toISOString(),
          due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          org_id: orgId,
          client_id: clientId,
          status: 'sent',
          amount_cents: 150000, // $1,500
          issued_at: new Date().toISOString(),
          due_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          org_id: orgId,
          client_id: clientId,
          status: 'overdue',
          amount_cents: 75000, // $750
          issued_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          due_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        }
      ])
      .select();

    if (invoicesError) {
      return NextResponse.json({ error: 'Failed to create invoices: ' + invoicesError.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      deals: dealsData,
      invoices: invoicesData,
      message: 'Sample data created successfully!'
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to seed data', details: error }, 
      { status: 500 }
    );
  }
}