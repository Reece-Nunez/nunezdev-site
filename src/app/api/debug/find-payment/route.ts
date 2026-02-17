import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Stripe from "stripe";

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

async function fetchStripePaymentDetails(paymentIntentId: string) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil',
  });

  try {
    console.log(`Fetching Stripe payment details for: ${paymentIntentId}`);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      success: true,
      payment: {
        id: paymentIntent.id,
        amount_received: paymentIntent.amount_received || paymentIntent.amount,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created: paymentIntent.created,
        customer: paymentIntent.customer,
        description: paymentIntent.description,
        metadata: paymentIntent.metadata,
        charges: (paymentIntent as any).charges?.data || []
      }
    };
  } catch (error: any) {
    console.error('Error fetching Stripe payment:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch payment details from Stripe'
    };
  }
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
    // First, fetch the actual payment details from Stripe
    const stripePaymentResult = await fetchStripePaymentDetails(paymentIntentId);
    if (!stripePaymentResult.success) {
      return NextResponse.json({ 
        error: `Failed to fetch payment from Stripe: ${stripePaymentResult.error}` 
      }, { status: 400 });
    }

    const stripePayment = stripePaymentResult.payment!;
    const actualAmountCents = stripePayment.amount_received; // Use amount_received for actual paid amount
    const actualAmountUSD = (actualAmountCents / 100).toFixed(2);
    const paymentDate = new Date(stripePayment.created * 1000).toISOString(); // Convert Unix timestamp
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

    // Search for all invoices - show all to allow flexibility (including those with payment intents)
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
      .or("status.eq.sent,status.eq.draft,status.eq.paid,status.eq.partially_paid,status.eq.overdue")
      .order('created_at', { ascending: false })
      .limit(50);

    if (invoicesError) {
      console.error("Error searching invoices:", invoicesError);
      return NextResponse.json({ error: invoicesError.message }, { status: 500 });
    }

    // Get all payments for all invoices to calculate accurate remaining balances
    const invoiceIds = (potentialInvoices || []).map(inv => inv.id);
    const { data: allInvoicePayments } = await gate.supabase
      .from('invoice_payments')
      .select('invoice_id, amount_cents')
      .in('invoice_id', invoiceIds);

    // Create a map of invoice_id -> total_paid_cents
    const paymentTotals = (allInvoicePayments || []).reduce((acc, payment) => {
      acc[payment.invoice_id] = (acc[payment.invoice_id] || 0) + payment.amount_cents;
      return acc;
    }, {} as Record<string, number>);

    // Add remaining balance calculations and matching scores for each potential invoice
    const enhancedPotentialInvoices = (potentialInvoices || []).map(invoice => {
      let matchScore = 0;
      let matchReasons: string[] = [];
      
      // Calculate actual remaining balance using real payment data
      const actualTotalPaid = paymentTotals[invoice.id] || 0;
      const actualRemainingBalance = Math.max(invoice.amount_cents - actualTotalPaid, 0);
      
      // Check amount match against actual remaining balance
      const amountDiff = Math.abs(actualRemainingBalance - actualAmountCents);
      if (amountDiff === 0) {
        matchScore += 100;
        matchReasons.push("exact amount match");
      } else if (amountDiff <= 100) { // Within $1
        matchScore += 50;
        matchReasons.push("close amount match");
      }
      
      // Check if Stripe customer email matches invoice client email
      if (stripePayment.customer && (invoice.clients as any)?.email) {
        // We'd need to fetch customer details from Stripe to compare emails
        // For now, just note this as a potential match
        matchReasons.push("stripe customer linked");
      }
      
      // Check if invoice already has this payment intent (high match)
      if (invoice.stripe_payment_intent_id === paymentIntentId) {
        matchScore += 200;
        matchReasons.push("already linked payment intent");
      }
      
      // Prioritize unpaid invoices
      if (invoice.status !== 'paid') {
        matchScore += 10;
      }
      
      return {
        ...invoice,
        // Override with actual calculated values
        total_paid_cents: actualTotalPaid,
        remaining_balance_cents: actualRemainingBalance,
        remaining_after_payment: Math.max(actualRemainingBalance - actualAmountCents, 0),
        will_be_fully_paid: actualRemainingBalance <= actualAmountCents,
        payment_fits: actualAmountCents <= actualRemainingBalance,
        match_score: matchScore,
        match_reasons: matchReasons
      };
    }).sort((a, b) => b.match_score - a.match_score); // Sort by match score

    const result = {
      payment_intent_id: paymentIntentId,
      stripe_payment_details: {
        amount_cents: actualAmountCents,
        amount_usd: actualAmountUSD,
        currency: stripePayment.currency,
        status: stripePayment.status,
        created_date: paymentDate,
        description: stripePayment.description,
        customer: stripePayment.customer
      },
      target_amount: actualAmountCents,
      target_amount_usd: actualAmountUSD,
      search_results: {
        existing_payment_records: existingPayment || [],
        invoice_with_payment_intent: invoiceWithPaymentIntent || [],
        potential_invoice_matches: enhancedPotentialInvoices
      },
      analysis: {
        payment_already_recorded: (existingPayment || []).length > 0,
        invoice_has_payment_intent: (invoiceWithPaymentIntent || []).length > 0,
        potential_matches_count: enhancedPotentialInvoices.length,
        stripe_payment_fetched: true,
        stripe_payment_status: stripePayment.status,
        note: `Found Stripe payment of $${actualAmountUSD}. Invoices show remaining balance after this payment is applied.`
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

  // Use admin client for payment operations to bypass RLS
  const adminSupabase = supabaseAdmin();

  try {
    const { 
      invoice_id, 
      payment_intent_id, 
      payment_date, 
      payment_amount_cents, 
      force_create_missing 
    } = await request.json();

    console.log(`Creating payment link: invoice ${invoice_id} -> payment ${payment_intent_id}`);

    // Fetch the actual payment details from Stripe first
    const stripePaymentResult = await fetchStripePaymentDetails(payment_intent_id);
    if (!stripePaymentResult.success) {
      return NextResponse.json({ 
        error: `Failed to fetch payment from Stripe: ${stripePaymentResult.error}` 
      }, { status: 400 });
    }

    const stripePayment = stripePaymentResult.payment!;
    const stripeAmountCents = stripePayment.amount_received;
    const stripePaymentDate = new Date(stripePayment.created * 1000).toISOString();

    // Get the invoice details
    const { data: invoice, error: invoiceError } = await adminSupabase
      .from('invoices')
      .select('id, invoice_number, amount_cents, status, client_id, stripe_payment_intent_id, clients(name, email)')
      .eq('id', invoice_id)
      .eq('org_id', gate.orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if this specific payment intent + invoice combination already exists
    const { data: existingPaymentForInvoice } = await adminSupabase
      .from('invoice_payments')
      .select('id')
      .eq('stripe_payment_intent_id', payment_intent_id)
      .eq('invoice_id', invoice_id)
      .single();

    // If this exact payment intent is already linked to this specific invoice, return error
    if (existingPaymentForInvoice && !force_create_missing) {
      return NextResponse.json({ error: 'This payment is already linked to this invoice' }, { status: 400 });
    }

    // If payment exists for this invoice and we ARE forcing creation, return error too (shouldn't happen)
    if (existingPaymentForInvoice && force_create_missing) {
      return NextResponse.json({ error: 'Payment record already exists for this invoice - no need to create missing record' }, { status: 400 });
    }

    // Special case: Invoice already has this payment intent ID but no payment record exists
    // This happens when Stripe webhook created the link but payment record was missed
    if (invoice.stripe_payment_intent_id === payment_intent_id || force_create_missing) {
      console.log('Creating missing payment record for already-linked invoice');
      
      // Determine payment amount (priority: custom amount > stripe amount > invoice amount)
      const finalAmountCents = payment_amount_cents || stripeAmountCents;
      
      // Use provided date or Stripe date or current date
      const finalPaidAt = payment_date ? new Date(payment_date).toISOString() : stripePaymentDate;
      
      // Create the missing payment record
      const paymentData = {
        invoice_id: invoice.id,
        amount_cents: finalAmountCents,
        paid_at: finalPaidAt,
        payment_method: 'card',
        stripe_payment_intent_id: payment_intent_id,
        metadata: {
          source: 'fix_stripe_payment_missing_record',
          created_missing_record: true,
          created_at: new Date().toISOString(),
          invoice_number: invoice.invoice_number,
          original_payment_date: payment_date || 'not_specified',
          custom_amount: payment_amount_cents ? true : false,
          note: 'Created missing payment record for invoice that was already linked to Stripe'
        }
      };

      const { data: newPayment, error: paymentError } = await adminSupabase
        .from('invoice_payments')
        .insert(paymentData)
        .select('*')
        .single();

      if (paymentError) {
        console.error('Failed to create missing payment:', paymentError);
        return NextResponse.json({ error: paymentError.message }, { status: 400 });
      }

      // Calculate new invoice totals
      const { data: allPayments } = await adminSupabase
        .from('invoice_payments')
        .select('amount_cents')
        .eq('invoice_id', invoice.id);

      const totalPaidCents = (allPayments || []).reduce((sum, p) => sum + p.amount_cents, 0);
      const remainingBalanceCents = Math.max(invoice.amount_cents - totalPaidCents, 0);
      
      // Determine new status based on payment totals
      let newStatus = 'sent';
      if (totalPaidCents >= invoice.amount_cents) {
        newStatus = 'paid';
      } else if (totalPaidCents > 0) {
        newStatus = 'partially_paid';
      }

      // Update invoice totals to reflect the payment
      const { data: updatedInvoice, error: updateError } = await adminSupabase
        .from('invoices')
        .update({
          status: newStatus,
          total_paid_cents: totalPaidCents,
          remaining_balance_cents: remainingBalanceCents,
          paid_at: newStatus === 'paid' ? finalPaidAt : null
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
    const finalAmountCents = payment_amount_cents || stripeAmountCents;
    const finalPaidAt = payment_date ? new Date(payment_date).toISOString() : stripePaymentDate;
    
    const paymentData = {
      invoice_id: invoice.id,
      amount_cents: finalAmountCents,
      paid_at: finalPaidAt,
      payment_method: 'card',
      stripe_payment_intent_id: payment_intent_id,
      metadata: {
        source: 'fix_stripe_payment',
        linked_manually: true,
        created_at: new Date().toISOString(),
        invoice_number: invoice.invoice_number,
        original_payment_date: payment_date || 'not_specified',
        custom_amount: payment_amount_cents ? true : false,
        note: 'Payment manually linked via fix tool'
      }
    };

    const { data: newPayment, error: paymentError } = await adminSupabase
      .from('invoice_payments')
      .insert(paymentData)
      .select('*')
      .single();

    if (paymentError) {
      console.error('Failed to create payment:', paymentError);
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }

    // Calculate new invoice totals for regular flow
    const { data: allPaymentsRegular } = await adminSupabase
      .from('invoice_payments')
      .select('amount_cents')
      .eq('invoice_id', invoice.id);

    const totalPaidCentsRegular = (allPaymentsRegular || []).reduce((sum, p) => sum + p.amount_cents, 0);
    const remainingBalanceCentsRegular = Math.max(invoice.amount_cents - totalPaidCentsRegular, 0);
    
    // Determine new status based on payment totals
    let newStatusRegular = 'sent';
    if (totalPaidCentsRegular >= invoice.amount_cents) {
      newStatusRegular = 'paid';
    } else if (totalPaidCentsRegular > 0) {
      newStatusRegular = 'partially_paid';
    }

    // Update invoice status
    const { data: updatedInvoice, error: updateError } = await adminSupabase
      .from('invoices')
      .update({
        status: newStatusRegular,
        stripe_payment_intent_id: payment_intent_id,
        total_paid_cents: totalPaidCentsRegular,
        remaining_balance_cents: remainingBalanceCentsRegular,
        paid_at: newStatusRegular === 'paid' ? finalPaidAt : null
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