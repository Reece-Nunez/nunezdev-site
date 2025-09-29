import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuthedOrgId() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, json: { error: "Unauthorized" as const } };

  const { data: m, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (error) return { ok: false as const, status: 400 as const, json: { error: error.message } };
  const orgId = m?.[0]?.org_id;
  if (!orgId) return { ok: false as const, status: 403 as const, json: { error: "No org" as const } };

  return { ok: true as const, supabase, orgId, user };
}

// GET - List recurring invoices
export async function GET(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all';
  const clientId = searchParams.get('client_id');

  try {
    let query = gate.supabase
      .from('recurring_invoices')
      .select(`
        *,
        clients!client_id (
          id,
          name,
          email,
          company,
          phone
        )
      `)
      .eq('org_id', gate.orgId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data: recurringInvoices, error } = await query;

    if (error) {
      console.error('Error fetching recurring invoices:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      recurring_invoices: recurringInvoices || [],
      count: (recurringInvoices || []).length
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch recurring invoices',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST - Create recurring invoice
export async function POST(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const adminSupabase = supabaseAdmin();

  try {
    const {
      client_id,
      title,
      description,
      line_items,
      amount_cents,
      frequency,
      start_date,
      end_date,
      day_of_month,
      payment_terms,
      require_signature,
      brand_logo_url,
      brand_primary
    } = await request.json();

    // Validate required fields
    if (!client_id || !title || !line_items || !amount_cents || !frequency || !start_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: client_id, title, line_items, amount_cents, frequency, start_date' 
      }, { status: 400 });
    }

    // Verify client belongs to org
    const { data: client, error: clientError } = await gate.supabase
      .from('clients')
      .select('id, name, email')
      .eq('id', client_id)
      .eq('org_id', gate.orgId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Calculate next invoice date
    const startDate = new Date(start_date);
    let nextInvoiceDate = new Date(startDate);

    // If day_of_month is specified for monthly frequency, adjust the next invoice date
    if (frequency === 'monthly' && day_of_month) {
      nextInvoiceDate.setDate(day_of_month);
      // If the day has already passed this month, move to next month
      if (nextInvoiceDate < startDate) {
        nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
      }
    }

    const recurringInvoiceData = {
      org_id: gate.orgId,
      client_id,
      title,
      description,
      line_items,
      amount_cents,
      frequency,
      start_date: startDate.toISOString().split('T')[0],
      end_date: end_date ? new Date(end_date).toISOString().split('T')[0] : null,
      next_invoice_date: nextInvoiceDate.toISOString().split('T')[0],
      day_of_month: frequency === 'monthly' ? day_of_month : null,
      payment_terms: payment_terms || '30',
      require_signature: require_signature || false,
      brand_logo_url,
      brand_primary,
      status: 'active'
    };

    const { data: newRecurringInvoice, error: insertError } = await adminSupabase
      .from('recurring_invoices')
      .insert(recurringInvoiceData)
      .select(`
        *,
        clients!client_id (
          id,
          name,
          email,
          company,
          phone
        )
      `)
      .single();

    if (insertError) {
      console.error('Error creating recurring invoice:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Recurring invoice created for ${client.name}`,
      recurring_invoice: newRecurringInvoice
    });

  } catch (error) {
    console.error('Error creating recurring invoice:', error);
    return NextResponse.json({
      error: 'Failed to create recurring invoice',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PUT - Update recurring invoice
export async function PUT(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const adminSupabase = supabaseAdmin();

  try {
    const {
      id,
      title,
      description,
      line_items,
      amount_cents,
      frequency,
      day_of_month,
      end_date,
      status,
      payment_terms,
      require_signature,
      brand_logo_url,
      brand_primary
    } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Recurring invoice ID is required' }, { status: 400 });
    }

    // Verify recurring invoice belongs to org
    const { data: existingInvoice, error: fetchError } = await gate.supabase
      .from('recurring_invoices')
      .select('id, client_id, frequency, next_invoice_date')
      .eq('id', id)
      .eq('org_id', gate.orgId)
      .single();

    if (fetchError || !existingInvoice) {
      return NextResponse.json({ error: 'Recurring invoice not found' }, { status: 404 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Only update provided fields
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (line_items !== undefined) updateData.line_items = line_items;
    if (amount_cents !== undefined) updateData.amount_cents = amount_cents;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (day_of_month !== undefined) updateData.day_of_month = frequency === 'monthly' ? day_of_month : null;
    if (end_date !== undefined) updateData.end_date = end_date ? new Date(end_date).toISOString().split('T')[0] : null;
    if (status !== undefined) updateData.status = status;
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms;
    if (require_signature !== undefined) updateData.require_signature = require_signature;
    if (brand_logo_url !== undefined) updateData.brand_logo_url = brand_logo_url;
    if (brand_primary !== undefined) updateData.brand_primary = brand_primary;

    const { data: updatedInvoice, error: updateError } = await adminSupabase
      .from('recurring_invoices')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', gate.orgId)
      .select(`
        *,
        clients!client_id (
          id,
          name,
          email,
          company,
          phone
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating recurring invoice:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Recurring invoice updated successfully',
      recurring_invoice: updatedInvoice
    });

  } catch (error) {
    console.error('Error updating recurring invoice:', error);
    return NextResponse.json({
      error: 'Failed to update recurring invoice',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}