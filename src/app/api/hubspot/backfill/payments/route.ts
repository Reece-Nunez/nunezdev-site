import { NextResponse } from "next/server";
import { hsGet, HSListResp } from "@/lib/hubspot";
import { supabaseServer } from "@/lib/supabaseServer";

type HSPaymentRecord = {
  id: string;
  properties?: {
    hs_customer_email?: string;
    hs_initial_amount?: string;
    hs_net_amount?: string;
    hs_initiated_date?: string;
    hs_latest_status?: string;
    hs_payment_id?: string;
    createdate?: string;
    lastmodifieddate?: string;
  };
  associations?: {
    deals?: { results?: { id: string }[] };
    contacts?: { results?: { id: string }[] };
    line_items?: { results?: { id: string }[] };
    quotes?: { results?: { id: string }[] };
  };
};

interface PaymentMatchResult {
  payment: HSPaymentRecord;
  matchedInvoice?: {
    id: string;
    amount_cents: number;
    client_email: string;
    hubspot_quote_id?: string;
  };
  matchReason?: string;
}

async function findMatchingInvoice(
  payment: HSPaymentRecord,
  supabase: any,
  orgId: string
): Promise<PaymentMatchResult["matchedInvoice"]> {
  
  // Strategy 1: Match by associated quote (most direct for payments)
  const quoteId = payment.associations?.quotes?.results?.[0]?.id;
  if (quoteId) {
    console.log(`[findMatchingInvoice] Payment ${payment.id} is associated with quote ${quoteId}`);
    
    // Find invoice that was created from this quote
    const { data: invoiceByQuote } = await supabase
      .from('invoices')
      .select(`
        id,
        amount_cents,
        hubspot_quote_id,
        clients!inner(email)
      `)
      .eq('hubspot_quote_id', quoteId)
      .eq('org_id', orgId)
      .single();
    
    if (invoiceByQuote) {
      console.log(`[findMatchingInvoice] Found invoice ${invoiceByQuote.id} for quote ${quoteId}`);
      return {
        id: invoiceByQuote.id,
        amount_cents: invoiceByQuote.amount_cents,
        client_email: invoiceByQuote.clients.email,
        hubspot_quote_id: invoiceByQuote.hubspot_quote_id
      };
    }
  }

  // Strategy 2: Match by associated deal
  const dealId = payment.associations?.deals?.results?.[0]?.id;
  if (dealId) {
    // Find invoice by HubSpot quote associated with this deal
    const { data: invoiceByDeal } = await supabase
      .from('invoices')
      .select(`
        id,
        amount_cents,
        hubspot_quote_id,
        clients!inner(email)
      `)
      .eq('org_id', orgId)
      .not('hubspot_quote_id', 'is', null);

    if (invoiceByDeal?.length) {
      // Check if any of these invoices have quotes associated with the deal
      for (const invoice of invoiceByDeal) {
        try {
          // Get the quote and check if it's associated with this deal
          const quoteResponse = await hsGet<{ 
            associations?: { 
              deals?: { results?: { id: string }[] } 
            } 
          }>(`/crm/v3/objects/quotes/${invoice.hubspot_quote_id}/associations/deals`);
          
          if (quoteResponse.associations?.deals?.results?.some(d => d.id === dealId)) {
            return {
              id: invoice.id,
              amount_cents: invoice.amount_cents,
              client_email: invoice.clients.email,
              hubspot_quote_id: invoice.hubspot_quote_id
            };
          }
        } catch (error) {
          console.warn(`Failed to check quote associations for ${invoice.hubspot_quote_id}:`, error);
        }
      }
    }
  }

  // Strategy 2: Match by customer email directly (most reliable for HubSpot payments)
  const customerEmail = payment.properties?.hs_customer_email;
  if (customerEmail) {
    const paymentAmount = Math.round(parseFloat(payment.properties?.hs_initial_amount || payment.properties?.hs_net_amount || '0') * 100);
    
    if (paymentAmount > 0) {
      const tolerance = Math.max(50, paymentAmount * 0.05);
      
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
        .gte('amount_cents', paymentAmount - tolerance)
        .lte('amount_cents', paymentAmount + tolerance)
        .in('status', ['sent', 'paid', 'partially_paid'])
        .order('issued_at', { ascending: false });

      if (invoices?.length === 1) {
        return {
          id: invoices[0].id,
          amount_cents: invoices[0].amount_cents,
          client_email: invoices[0].clients.email,
          hubspot_quote_id: invoices[0].hubspot_quote_id
        };
      }

      const exactMatch = invoices?.find((inv: any) => inv.amount_cents === paymentAmount);
      if (exactMatch) {
        return {
          id: exactMatch.id,
          amount_cents: exactMatch.amount_cents,
          client_email: exactMatch.clients.email,
          hubspot_quote_id: exactMatch.hubspot_quote_id
        };
      }
    }
  }

  // Strategy 3: Match by contact email and amount
  const contactId = payment.associations?.contacts?.results?.[0]?.id;
  if (contactId) {
    try {
      // Get contact email
      const contact = await hsGet<{ properties?: { email?: string } }>(
        `/crm/v3/objects/contacts/${contactId}`, 
        { properties: "email" }
      );
      
      const contactEmail = contact.properties?.email;
      if (contactEmail) {
        const paymentAmount = Math.round(parseFloat(payment.properties?.hs_initial_amount || payment.properties?.hs_net_amount || '0') * 100);
        
        if (paymentAmount > 0) {
          // Look for invoices with matching email and amount (within 5% tolerance)
          const tolerance = Math.max(50, paymentAmount * 0.05);
          
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
            .eq('clients.email', contactEmail)
            .eq('org_id', orgId)
            .gte('amount_cents', paymentAmount - tolerance)
            .lte('amount_cents', paymentAmount + tolerance)
            .in('status', ['sent', 'paid', 'partially_paid'])
            .order('issued_at', { ascending: false });

          if (invoices?.length === 1) {
            return {
              id: invoices[0].id,
              amount_cents: invoices[0].amount_cents,
              client_email: invoices[0].clients.email,
              hubspot_quote_id: invoices[0].hubspot_quote_id
            };
          }

          // If multiple matches, prefer the one with exact amount
          const exactMatch = invoices?.find((inv: any) => inv.amount_cents === paymentAmount);
          if (exactMatch) {
            return {
              id: exactMatch.id,
              amount_cents: exactMatch.amount_cents,
              client_email: exactMatch.clients.email,
              hubspot_quote_id: exactMatch.hubspot_quote_id
            };
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch contact ${contactId}:`, error);
    }
  }

  return undefined;
}

/**
 * GET /api/hubspot/backfill/payments?limit=100&dry=true
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "100");
  const dry = url.searchParams.get("dry") === "true";

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = memberships?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  try {
    console.log(`[hubspot-payments-backfill] Starting payment backfill (limit: ${limit}, dry: ${dry})`);

    let after: string | undefined;
    let scanned = 0;
    const results: PaymentMatchResult[] = [];
    let matched = 0;
    let added = 0;
    let skipped = 0;
    let errors = 0;

    while (scanned < limit) {
      try {
        // Fetch payments from HubSpot Commerce Hub
        const batch = await hsGet<HSListResp<HSPaymentRecord>>("/crm/v3/objects/commerce_payments", {
          properties: "hs_customer_email,hs_initial_amount,hs_net_amount,hs_initiated_date,hs_latest_status,hs_payment_id,createdate,lastmodifieddate",
          associations: "deals,contacts,line_items,quotes",
          limit: "100",
          after
        });

        if (!batch.results.length) break;

        for (const payment of batch.results) {
          scanned++;
          
          const props = payment.properties || {};
          const amount = props.hs_initial_amount || props.hs_net_amount || '0';
          console.log(`[hubspot-payments-backfill] Processing payment: ${payment.id} ($${amount})`);
          console.log(`[hubspot-payments-backfill] - Customer email: ${props.hs_customer_email}`);
          console.log(`[hubspot-payments-backfill] - Status: ${props.hs_latest_status}`);

          try {
            const matchedInvoice = await findMatchingInvoice(payment, supabase, orgId);
            
            const result: PaymentMatchResult = {
              payment,
              matchedInvoice
            };

            if (matchedInvoice) {
              matched++;
              
              // Determine match reason - prioritize quote association as it's most direct
              result.matchReason = payment.associations?.quotes?.results?.[0]?.id ? 'quote_association' :
                                  props.hs_customer_email ? 'customer_email_amount' : 
                                  payment.associations?.deals?.results?.[0]?.id ? 'deal_association' : 
                                  'contact_email_amount';

              if (!dry) {
                // Check if payment already exists
                const { data: existing } = await supabase
                  .from('invoice_payments')
                  .select('id')
                  .eq('metadata->>hubspot_payment_id', payment.id)
                  .single();

                if (!existing) {
                  const paymentAmount = Math.round(parseFloat(amount) * 100);
                  
                  // Add payment record
                  const { error } = await supabase
                    .from('invoice_payments')
                    .insert({
                      invoice_id: matchedInvoice.id,
                      amount_cents: paymentAmount,
                      payment_method: 'hubspot',
                      paid_at: props.hs_initiated_date ? new Date(props.hs_initiated_date).toISOString() : new Date(props.createdate || Date.now()).toISOString(),
                      metadata: {
                        source: 'hubspot',
                        hubspot_payment_id: payment.id,
                        hubspot_internal_payment_id: props.hs_payment_id,
                        status: props.hs_latest_status,
                        customer_email: props.hs_customer_email,
                        match_reason: result.matchReason,
                        backfilled: true
                      }
                    });

                  if (!error) {
                    added++;
                    console.log(`[hubspot-payments-backfill] Added payment for invoice ${matchedInvoice.id}`);
                  } else {
                    console.error(`[hubspot-payments-backfill] Failed to add payment:`, error);
                    errors++;
                  }
                } else {
                  skipped++;
                  console.log(`[hubspot-payments-backfill] Payment already exists for HubSpot payment ${payment.id}`);
                }
              }
            } else {
              console.log(`[hubspot-payments-backfill] No matching invoice found for payment ${payment.id}`);
            }

            results.push(result);
            
          } catch (error) {
            console.error(`[hubspot-payments-backfill] Error processing payment ${payment.id}:`, error);
            errors++;
            results.push({
              payment,
              matchReason: 'error'
            });
          }
        }

        after = batch.paging?.next?.after;
        if (!after) break;
        
      } catch (error) {
        console.error(`[hubspot-payments-backfill] Error fetching payments batch:`, error);
        // If we can't fetch payments, it might be a permissions issue
        if (error instanceof Error) {
          if (error.message.includes('MISSING_SCOPES')) {
            return NextResponse.json({
              error: "Missing HubSpot scopes for payments. You need 'e-commerce' scope to access payment records.",
              scopes_needed: ["e-commerce"]
            }, { status: 403 });
          }
          if (error.message.includes('Unable to infer object type')) {
            return NextResponse.json({
              error: "HubSpot payments API not available. This requires Commerce Hub API access, which may not be included in your HubSpot plan.",
              help: "You can view payments in HubSpot UI but cannot access them via API. Consider manually tracking payments or upgrading to a plan with Commerce Hub API access.",
              alternative: "You can manually add payment records using the invoice payments table in your database."
            }, { status: 400 });
          }
        }
        break;
      }
    }

    const summary = {
      total_processed: scanned,
      matched,
      added,
      skipped,
      errors,
      dry_run: dry
    };

    console.log(`[hubspot-payments-backfill] Summary:`, summary);

    return NextResponse.json({
      success: true,
      summary,
      results: dry ? results.map(r => ({
        payment_id: r.payment.id,
        amount: r.payment.properties?.hs_initial_amount || r.payment.properties?.hs_net_amount,
        customer_email: r.payment.properties?.hs_customer_email,
        status: r.payment.properties?.hs_latest_status,
        payment_date: r.payment.properties?.hs_initiated_date,
        matched_invoice_id: r.matchedInvoice?.id,
        match_reason: r.matchReason,
        quote_id: r.payment.associations?.quotes?.results?.[0]?.id,
        deal_id: r.payment.associations?.deals?.results?.[0]?.id,
        contact_id: r.payment.associations?.contacts?.results?.[0]?.id
      })) : undefined
    });

  } catch (error) {
    console.error('[hubspot-payments-backfill] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: `Failed to backfill HubSpot payments: ${message}` 
    }, { status: 500 });
  }
}