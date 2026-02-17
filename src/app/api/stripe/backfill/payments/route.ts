import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PaymentMatchResult {
  paymentIntent: Stripe.PaymentIntent;
  matchedInvoice?: {
    id: string;
    amount_cents: number;
    client_email: string;
    hubspot_quote_id?: string;
  };
  matchReason?: string;
}

async function findMatchingInvoice(
  paymentIntent: Stripe.PaymentIntent,
  supabase: any,
  orgId: string,
  stripe: Stripe
): Promise<PaymentMatchResult["matchedInvoice"]> {
  
  // Strategy 1: Check metadata for direct invoice ID
  if (paymentIntent.metadata?.invoice_id) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select(`
        id,
        amount_cents,
        clients!inner(email)
      `)
      .eq('id', paymentIntent.metadata.invoice_id)
      .eq('org_id', orgId)
      .single();
    
    if (invoice) {
      return {
        id: invoice.id,
        amount_cents: invoice.amount_cents,
        client_email: invoice.clients.email
      };
    }
  }

  // Strategy 2: Check metadata for HubSpot quote ID  
  if (paymentIntent.metadata?.hubspot_quote_id) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select(`
        id,
        amount_cents,
        hubspot_quote_id,
        clients!inner(email)
      `)
      .eq('hubspot_quote_id', paymentIntent.metadata.hubspot_quote_id)
      .eq('org_id', orgId)
      .single();
    
    if (invoice) {
      return {
        id: invoice.id,
        amount_cents: invoice.amount_cents,
        client_email: invoice.clients.email,
        hubspot_quote_id: invoice.hubspot_quote_id
      };
    }
  }

  // Strategy 3: Match by HubSpot metadata (if payment came from HubSpot)
  if (paymentIntent.metadata?.checkoutSessionId || paymentIntent.metadata?.portalId) {
    console.log(`[findMatchingInvoice] Payment has HubSpot metadata, searching by quotes and invoices`);
    
    // The documentation says "Once payment is confirmed, the payment is automatically associated to the quote"
    // So we should try to find the quote this payment is associated with, then find the invoice from that quote
    
    const tolerance = Math.max(50, paymentIntent.amount * 0.05);
    
    const { data: quotedInvoices } = await supabase
      .from('invoices')
      .select(`
        id,
        amount_cents,
        hubspot_quote_id,
        clients!inner(email)
      `)
      .eq('org_id', orgId)
      .not('hubspot_quote_id', 'is', null)
      .gte('amount_cents', paymentIntent.amount - tolerance)
      .lte('amount_cents', paymentIntent.amount + tolerance)
      .in('status', ['sent', 'paid', 'partially_paid'])
      .order('issued_at', { ascending: false });

    console.log(`[findMatchingInvoice] Found ${quotedInvoices?.length || 0} invoices with HubSpot quotes by amount`);
    
    if (quotedInvoices?.length === 1) {
      console.log(`[findMatchingInvoice] Single quoted invoice match: ${quotedInvoices[0].id}`);
      return {
        id: quotedInvoices[0].id,
        amount_cents: quotedInvoices[0].amount_cents,
        client_email: quotedInvoices[0].clients.email,
        hubspot_quote_id: quotedInvoices[0].hubspot_quote_id
      };
    }

    // If multiple quoted invoices, prefer exact amount
    const exactQuotedMatch = quotedInvoices?.find((inv: any) => inv.amount_cents === paymentIntent.amount);
    if (exactQuotedMatch) {
      console.log(`[findMatchingInvoice] Exact amount quoted invoice match: ${exactQuotedMatch.id}`);
      return {
        id: exactQuotedMatch.id,
        amount_cents: exactQuotedMatch.amount_cents,
        client_email: exactQuotedMatch.clients.email,
        hubspot_quote_id: exactQuotedMatch.hubspot_quote_id
      };
    }

    // Fallback: Look for any invoices with similar amounts created around the same time
    const paymentDate = new Date(paymentIntent.created * 1000);
    const startDate = new Date(paymentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(paymentDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const { data: invoices } = await supabase
      .from('invoices')
      .select(`
        id,
        amount_cents,
        issued_at,
        hubspot_quote_id,
        clients!inner(email)
      `)
      .eq('org_id', orgId)
      .gte('amount_cents', paymentIntent.amount - tolerance)
      .lte('amount_cents', paymentIntent.amount + tolerance)
      .gte('issued_at', startDate.toISOString())
      .lte('issued_at', endDate.toISOString())
      .in('status', ['sent', 'paid', 'partially_paid'])
      .order('issued_at', { ascending: false });

    console.log(`[findMatchingInvoice] Found ${invoices?.length || 0} invoices by amount and timing`);
    
    if (invoices?.length === 1) {
      console.log(`[findMatchingInvoice] Single match found: ${invoices[0].id}`);
      return {
        id: invoices[0].id,
        amount_cents: invoices[0].amount_cents,
        client_email: invoices[0].clients.email,
        hubspot_quote_id: invoices[0].hubspot_quote_id
      };
    }

    // If multiple matches, prefer exact amount
    const exactMatch = invoices?.find((inv: any) => inv.amount_cents === paymentIntent.amount);
    if (exactMatch) {
      console.log(`[findMatchingInvoice] Exact amount match found: ${exactMatch.id}`);
      return {
        id: exactMatch.id,
        amount_cents: exactMatch.amount_cents,
        client_email: exactMatch.clients.email,
        hubspot_quote_id: exactMatch.hubspot_quote_id
      };
    }
  }

  // Strategy 4: Get customer email and match by email + amount
  let customerEmail: string | null = null;
  
  if (paymentIntent.customer) {
    try {
      // If customer is already expanded, use it directly
      if (typeof paymentIntent.customer === 'object' && 'email' in paymentIntent.customer) {
        customerEmail = paymentIntent.customer.email;
      } 
      // If customer is just an ID, fetch it
      else if (typeof paymentIntent.customer === 'string') {
        const customer = await stripe.customers.retrieve(paymentIntent.customer);
        if ('email' in customer) {
          customerEmail = customer.email;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch customer:', error);
    }
  }

  // Use receipt email as fallback
  customerEmail = customerEmail || paymentIntent.receipt_email;

  console.log(`[findMatchingInvoice] Payment ${paymentIntent.id}: amount=${paymentIntent.amount}, email=${customerEmail}`);

  if (customerEmail) {
    // Look for invoices with matching email and amount (within 5% tolerance for fees/rounding)
    const tolerance = Math.max(50, paymentIntent.amount * 0.05); // 5% or $0.50, whichever is larger
    
    console.log(`[findMatchingInvoice] Searching for invoices: email=${customerEmail}, amount range=${paymentIntent.amount - tolerance}-${paymentIntent.amount + tolerance}`);
    
    const { data: invoices } = await supabase
      .from('invoices')
      .select(`
        id,
        amount_cents,
        hubspot_quote_id,
        status,
        issued_at,
        clients!inner(email)
      `)
      .eq('clients.email', customerEmail)
      .eq('org_id', orgId)
      .gte('amount_cents', paymentIntent.amount - tolerance)
      .lte('amount_cents', paymentIntent.amount + tolerance)
      .in('status', ['sent', 'paid', 'partially_paid'])
      .order('issued_at', { ascending: false });

    console.log(`[findMatchingInvoice] Found ${invoices?.length || 0} potential matches`);
    if (invoices?.length) {
      invoices.forEach((inv: any) => {
        console.log(`[findMatchingInvoice] - Invoice ${inv.id}: amount=${inv.amount_cents}, status=${inv.status}, email=${inv.clients.email}`);
      });
    }

    if (invoices?.length === 1) {
      return {
        id: invoices[0].id,
        amount_cents: invoices[0].amount_cents,
        client_email: invoices[0].clients.email,
        hubspot_quote_id: invoices[0].hubspot_quote_id
      };
    }

    // If multiple matches, prefer the one with exact amount
    const exactMatch = invoices?.find((inv: any) => inv.amount_cents === paymentIntent.amount);
    if (exactMatch) {
      return {
        id: exactMatch.id,
        amount_cents: exactMatch.amount_cents,
        client_email: exactMatch.clients.email,
        hubspot_quote_id: exactMatch.hubspot_quote_id
      };
    }
  } else {
    console.log(`[findMatchingInvoice] No email found for payment ${paymentIntent.id}`);
  }

  return undefined;
}

/**
 * GET /api/stripe/backfill/payments?limit=100&dry=true&start_date=2024-01-01
 */
export async function GET(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "100");
  const dry = url.searchParams.get("dry") === "true";
  const startDate = url.searchParams.get("start_date"); // YYYY-MM-DD format

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  try {
    console.log(`[stripe-backfill] Starting payment backfill (limit: ${limit}, dry: ${dry})`);

    // Build query parameters for Stripe
    const queryParams: Stripe.PaymentIntentListParams = {
      limit: Math.min(limit, 100), // Stripe max is 100
      expand: ['data.customer'],
    };

    // Add date filter if provided
    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      queryParams.created = { gte: startTimestamp };
    }

    // Fetch payment intents from Stripe
    const paymentIntents = await stripe.paymentIntents.list(queryParams);
    
    const results: PaymentMatchResult[] = [];
    let matched = 0;
    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const pi of paymentIntents.data) {
      // Only process successful payments
      if (pi.status !== 'succeeded') {
        skipped++;
        continue;
      }

      console.log(`[stripe-backfill] Processing payment intent: ${pi.id} ($${(pi.amount / 100).toFixed(2)})`);
      console.log(`[stripe-backfill] - Receipt email: ${pi.receipt_email}`);
      console.log(`[stripe-backfill] - Customer: ${pi.customer}`);
      console.log(`[stripe-backfill] - Metadata:`, pi.metadata);

      try {
        const matchedInvoice = await findMatchingInvoice(pi, supabase, orgId, stripe);
        
        const result: PaymentMatchResult = {
          paymentIntent: pi,
          matchedInvoice
        };

        if (matchedInvoice) {
          matched++;
          result.matchReason = pi.metadata?.invoice_id ? 'direct_id' :
                              pi.metadata?.hubspot_quote_id ? 'hubspot_id' :
                              (pi.metadata?.checkoutSessionId || pi.metadata?.portalId) ? 'hubspot_amount_timing' :
                              'email_amount_match';

          if (!dry) {
            // Check if payment already exists
            const { data: existing } = await supabase
              .from('invoice_payments')
              .select('id')
              .eq('stripe_payment_intent_id', pi.id)
              .single();

            if (!existing) {
              // Add payment record
              const { error } = await supabase
                .from('invoice_payments')
                .insert({
                  invoice_id: matchedInvoice.id,
                  stripe_payment_intent_id: pi.id,
                  amount_cents: pi.amount,
                  payment_method: pi.payment_method_types?.[0] || 'card',
                  paid_at: new Date(pi.created * 1000).toISOString(),
                  metadata: {
                    stripe_customer: pi.customer,
                    receipt_email: pi.receipt_email,
                    match_reason: result.matchReason,
                    backfilled: true
                  }
                });

              if (!error) {
                added++;
                console.log(`[stripe-backfill] Added payment for invoice ${matchedInvoice.id}`);
              } else {
                console.error(`[stripe-backfill] Failed to add payment:`, error);
                errors++;
              }
            } else {
              skipped++;
              console.log(`[stripe-backfill] Payment already exists for ${pi.id}`);
            }
          }
        } else {
          console.log(`[stripe-backfill] No matching invoice found for payment ${pi.id}`);
        }

        results.push(result);
        
      } catch (error) {
        console.error(`[stripe-backfill] Error processing payment ${pi.id}:`, error);
        errors++;
        results.push({
          paymentIntent: pi,
          matchReason: 'error'
        });
      }
    }

    const summary = {
      total_processed: paymentIntents.data.length,
      matched,
      added,
      skipped,
      errors,
      dry_run: dry
    };

    console.log(`[stripe-backfill] Summary:`, summary);

    return NextResponse.json({
      success: true,
      summary,
      results: dry ? results.map(r => ({
        payment_intent_id: r.paymentIntent.id,
        amount: r.paymentIntent.amount,
        customer_email: r.paymentIntent.receipt_email,
        matched_invoice_id: r.matchedInvoice?.id,
        match_reason: r.matchReason,
        created: new Date(r.paymentIntent.created * 1000).toISOString()
      })) : undefined
    });

  } catch (error) {
    console.error('[stripe-backfill] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: `Failed to backfill payments: ${message}` 
    }, { status: 500 });
  }
}