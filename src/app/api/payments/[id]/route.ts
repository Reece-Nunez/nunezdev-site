import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

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

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const { id } = params;

  try {
    const { data: payment, error } = await gate.supabase
      .from('invoice_payments')
      .select(`
        *,
        invoices!inner (
          id,
          invoice_number,
          description,
          org_id,
          clients (
            id,
            name,
            email
          )
        )
      `)
      .eq('id', id)
      .eq('invoices.org_id', gate.orgId)
      .single();

    if (error || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const { id } = params;

  try {
    // First, get the payment details to verify ownership and get invoice info
    const { data: payment, error: fetchError } = await gate.supabase
      .from('invoice_payments')
      .select(`
        *,
        invoices!inner (
          id,
          invoice_number,
          amount_cents,
          org_id,
          total_paid_cents,
          remaining_balance_cents,
          clients (
            name
          )
        )
      `)
      .eq('id', id)
      .eq('invoices.org_id', gate.orgId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Delete the payment
    const { error: deleteError } = await gate.supabase
      .from('invoice_payments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting payment:', deleteError);
      return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
    }

    // Update the invoice totals after payment deletion
    // Recalculate the invoice's payment totals
    const { data: remainingPayments, error: paymentsError } = await gate.supabase
      .from('invoice_payments')
      .select('amount_cents')
      .eq('invoice_id', payment.invoices.id);

    if (paymentsError) {
      console.error('Error calculating remaining payments:', paymentsError);
      // Payment was deleted but we couldn't update invoice totals
      return NextResponse.json({ 
        success: true, 
        message: 'Payment deleted but invoice totals may need manual update',
        warning: 'Could not recalculate invoice totals'
      });
    }

    // Calculate new totals
    const totalPaidCents = remainingPayments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0;
    const remainingBalanceCents = payment.invoices.amount_cents - totalPaidCents;
    const newStatus = remainingBalanceCents <= 0 ? 'paid' : 'sent';

    // Update invoice
    const { error: updateError } = await gate.supabase
      .from('invoices')
      .update({
        total_paid_cents: totalPaidCents,
        remaining_balance_cents: remainingBalanceCents,
        status: newStatus
      })
      .eq('id', payment.invoices.id);

    if (updateError) {
      console.error('Error updating invoice after payment deletion:', updateError);
      return NextResponse.json({ 
        success: true, 
        message: 'Payment deleted but invoice totals may need manual update',
        warning: 'Could not update invoice totals'
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Payment of $${(payment.amount_cents / 100).toFixed(2)} deleted successfully`,
      details: {
        deleted_payment_id: id,
        invoice_number: payment.invoices.invoice_number,
        client_name: payment.invoices.clients?.name,
        new_invoice_status: newStatus,
        new_total_paid: totalPaidCents,
        new_remaining_balance: remainingBalanceCents
      }
    });

  } catch (error) {
    console.error('Unexpected error deleting payment:', error);
    return NextResponse.json({ 
      error: 'Failed to delete payment',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const { id } = params;

  try {
    const updateData = await request.json();
    const { amount_cents, payment_method, notes } = updateData;

    // First verify the payment exists and belongs to this org
    const { data: existingPayment, error: fetchError } = await gate.supabase
      .from('invoice_payments')
      .select(`
        *,
        invoices!inner (
          id,
          amount_cents,
          org_id
        )
      `)
      .eq('id', id)
      .eq('invoices.org_id', gate.orgId)
      .single();

    if (fetchError || !existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Prepare update data
    const updatePayload: any = {};
    
    if (amount_cents !== undefined) {
      updatePayload.amount_cents = Math.round(amount_cents);
    }
    
    if (payment_method !== undefined) {
      updatePayload.payment_method = payment_method;
    }

    if (notes !== undefined) {
      updatePayload.metadata = {
        ...existingPayment.metadata,
        notes: notes,
        last_updated: new Date().toISOString()
      };
    }

    // Update the payment
    const { data: updatedPayment, error: updateError } = await gate.supabase
      .from('invoice_payments')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        invoices (
          id,
          invoice_number,
          amount_cents,
          clients (
            name
          )
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }

    // If amount changed, recalculate invoice totals
    if (amount_cents !== undefined && amount_cents !== existingPayment.amount_cents) {
      const { data: allPayments, error: paymentsError } = await gate.supabase
        .from('invoice_payments')
        .select('amount_cents')
        .eq('invoice_id', existingPayment.invoices.id);

      if (!paymentsError && allPayments) {
        const totalPaidCents = allPayments.reduce((sum, p) => sum + p.amount_cents, 0);
        const remainingBalanceCents = existingPayment.invoices.amount_cents - totalPaidCents;
        const newStatus = remainingBalanceCents <= 0 ? 'paid' : 'sent';

        await gate.supabase
          .from('invoices')
          .update({
            total_paid_cents: totalPaidCents,
            remaining_balance_cents: remainingBalanceCents,
            status: newStatus
          })
          .eq('id', existingPayment.invoices.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment updated successfully',
      payment: updatedPayment
    });

  } catch (error) {
    console.error('Unexpected error updating payment:', error);
    return NextResponse.json({
      error: 'Failed to update payment',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}