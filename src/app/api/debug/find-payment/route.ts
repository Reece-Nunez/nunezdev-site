import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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

export async function GET(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const { searchParams } = new URL(request.url);
  const paymentIntentId = searchParams.get('payment_intent_id');
  
  if (!paymentIntentId) {
    return NextResponse.json({ error: 'payment_intent_id parameter is required' }, { status: 400 });
  }
  
  console.log(`Searching for payment intent: ${paymentIntentId} in org: ${gate.orgId}`);
  
  try {
    // Check if payment already exists in invoice_payments table
    const { data: existingPayment, error: paymentError } = await gate.supabase
      .from("invoice_payments")
      .select(`
        id,
        invoice_id,
        stripe_payment_intent_id,
        amount_cents,
        paid_at,
        payment_method,
        metadata,
        invoices!inner (
          id,
          invoice_number,
          amount_cents,
          status,
          client_id,
          stripe_payment_intent_id,
          org_id,
          clients (
            name,
            email
          )
        )
      `)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("invoices.org_id", gate.orgId);

    if (paymentError) {
      console.error("Error searching payments:", paymentError);
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    // Check if any invoice has this payment intent ID directly
    const { data: invoiceWithPaymentIntent, error: invoiceError } = await gate.supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        amount_cents,
        status,
        stripe_payment_intent_id,
        client_id,
        total_paid_cents,
        remaining_balance_cents,
        clients (
          name,
          email
        )
      `)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("org_id", gate.orgId);

    if (invoiceError) {
      console.error("Error searching invoices:", invoiceError);
      return NextResponse.json({ error: invoiceError.message }, { status: 500 });
    }

    // Search for all unpaid/recent invoices that might match this payment
    const { data: potentialInvoices, error: invoicesError } = await gate.supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        amount_cents,
        status,
        stripe_payment_intent_id,
        client_id,
        total_paid_cents,
        remaining_balance_cents,
        created_at,
        clients (
          name,
          email
        )
      `)
      .eq("org_id", gate.orgId)
      .or("status.eq.sent,status.eq.draft,status.eq.paid")
      .is("stripe_payment_intent_id", null) // Only invoices without payment intents
      .order('created_at', { ascending: false })
      .limit(50); // Show more results for flexibility

    if (invoicesError) {
      console.error("Error searching invoices:", invoicesError);
      return NextResponse.json({ error: invoicesError.message }, { status: 500 });
    }

    // We don't have a target amount since it should be determined by the user
    // The frontend will show the payment amount after a successful search
    const result = {
      payment_intent_id: paymentIntentId,
      target_amount: null, // Will be determined dynamically or by user selection
      target_amount_usd: "Unknown", // Will be determined when payment details are fetched
      search_results: {
        existing_payment_records: existingPayment || [],
        invoice_with_payment_intent: invoiceWithPaymentIntent || [],
        potential_invoice_matches: potentialInvoices || []
      },
      analysis: {
        payment_already_recorded: (existingPayment || []).length > 0,
        invoice_has_payment_intent: (invoiceWithPaymentIntent || []).length > 0,
        potential_matches_count: (potentialInvoices || []).length,
        note: "This tool shows all recent unpaid invoices. Select the correct invoice to link to this payment."
      }
    };

    console.log("Search completed:", result);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Unexpected error during search:", error);
    return NextResponse.json({ 
      error: "Search failed", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  try {
    const { invoice_id, payment_intent_id, force_create_missing } = await request.json();

    console.log(`Creating payment link: invoice ${invoice_id} -> payment ${payment_intent_id}`);

    // Get the invoice details
    const { data: invoice, error: invoiceError } = await gate.supabase
      .from('invoices')
      .select('id, invoice_number, amount_cents, status, client_id, stripe_payment_intent_id, clients(name, email)')
      .eq('id', invoice_id)
      .eq('org_id', gate.orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if payment already exists
    const { data: existingPayment } = await gate.supabase
      .from('invoice_payments')
      .select('id')
      .eq('stripe_payment_intent_id', payment_intent_id)
      .single();

    if (existingPayment) {
      return NextResponse.json({ error: 'Payment already linked' }, { status: 400 });
    }

    // Special case: Invoice already has this payment intent ID but no payment record exists
    // This happens when Stripe webhook created the link but payment record was missed
    if (invoice.stripe_payment_intent_id === payment_intent_id || force_create_missing) {
      console.log('Creating missing payment record for already-linked invoice');
      
      // Create the missing payment record
      const paymentData = {
        invoice_id: invoice.id,
        amount_cents: invoice.amount_cents,
        paid_at: new Date().toISOString(),
        payment_method: 'card',
        stripe_payment_intent_id: payment_intent_id,
        metadata: {
          source: 'fix_stripe_payment_missing_record',
          created_missing_record: true,
          created_at: new Date().toISOString(),
          invoice_number: invoice.invoice_number,
          note: 'Created missing payment record for invoice that was already linked to Stripe'
        }
      };

      const { data: newPayment, error: paymentError } = await gate.supabase
        .from('invoice_payments')
        .insert(paymentData)
        .select('*')
        .single();

      if (paymentError) {
        console.error('Failed to create missing payment:', paymentError);
        return NextResponse.json({ error: paymentError.message }, { status: 400 });
      }

      // Update invoice totals to reflect the payment
      const { data: updatedInvoice, error: updateError } = await gate.supabase
        .from('invoices')
        .update({
          status: 'paid',
          total_paid_cents: invoice.amount_cents,
          remaining_balance_cents: 0
        })
        .eq('id', invoice.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Failed to update invoice:', updateError);
      }

      const result = {
        success: true,
        message: `Missing payment record created for invoice ${invoice.invoice_number}`,
        changes: {
          payment_created: newPayment,
          final_invoice_state: updatedInvoice || invoice,
          action: 'created_missing_payment_record'
        }
      };

      console.log('Missing payment record created:', result);
      return NextResponse.json(result);
    }

    // Regular flow: Create new payment link
    const paymentData = {
      invoice_id: invoice.id,
      amount_cents: invoice.amount_cents,
      paid_at: new Date().toISOString(),
      payment_method: 'card',
      stripe_payment_intent_id: payment_intent_id,
      metadata: {
        source: 'fix_stripe_payment',
        linked_manually: true,
        created_at: new Date().toISOString(),
        invoice_number: invoice.invoice_number,
        note: 'Payment manually linked via fix tool'
      }
    };

    const { data: newPayment, error: paymentError } = await gate.supabase
      .from('invoice_payments')
      .insert(paymentData)
      .select('*')
      .single();

    if (paymentError) {
      console.error('Failed to create payment:', paymentError);
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    // Update invoice status to paid
    const { data: updatedInvoice, error: updateError } = await gate.supabase
      .from('invoices')
      .update({
        status: 'paid',
        stripe_payment_intent_id: payment_intent_id,
        total_paid_cents: invoice.amount_cents,
        remaining_balance_cents: 0
      })
      .eq('id', invoice.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update invoice:', updateError);
    }

    const result = {
      success: true,
      message: `Payment successfully linked to invoice ${invoice.invoice_number}`,
      changes: {
        payment_created: newPayment,
        final_invoice_state: updatedInvoice || invoice
      }
    };

    console.log('Payment linking completed:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Payment linking error:', error);
    return NextResponse.json({
      error: 'Payment linking failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}