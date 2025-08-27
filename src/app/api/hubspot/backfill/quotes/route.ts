import { NextResponse } from "next/server";
import { hsGet, HSListResp } from "@/lib/hubspot";
import { supabaseServer } from "@/lib/supabaseServer";

type HSQuote = {
  id: string;
  properties?: {
    hs_title?: string;
    hs_status?: string;
    hs_total_amount?: string;
    amount?: string;              // Alternative amount field
    hs_subtotal?: string;
    hs_tax?: string;
    hs_discount?: string;
    createdate?: string;
    hs_expiration_date?: string;
    hs_payment_status?: string;
    hs_public_url?: string;
    hs_payment_terms?: string;
    hs_payment_schedule?: string;
    hs_template?: string;
    hs_currency_code?: string;
    deal_currency_code?: string;
    hs_sender_firstname?: string;
    hs_sender_lastname?: string;
    hs_sender_email?: string;
    hs_quote_signature?: string;
    hs_signed_at?: string;
    hs_esignature_signed_at?: string;
  };
  associations?: {
    contacts?: { results?: { id: string }[] };
    deals?: { results?: { id: string }[] };
  };
};

// Type for HubSpot payments
type HSPayment = {
  id?: string;
  amount?: string;
  payment_date?: string;
  payment_method?: string;
  status?: string;
  currency_code?: string;
};

function mapStatus(hs?: string, pay?: string, dealStage?: string, hasPayments?: boolean) {
  const s = (hs ?? "").toLowerCase();
  const p = (pay ?? "").toLowerCase();
  const stage = (dealStage ?? "").toLowerCase();
  
  // Only mark as paid if explicitly stated or has payment records
  if (p === "paid" || hasPayments) return "paid";
  
  // Check deal stage for more accurate status
  if (stage.includes("won") || stage.includes("closed won")) {
    return hasPayments ? "paid" : "sent"; // Won deals should be sent, not automatically paid
  }
  
  if (stage.includes("contract") || stage.includes("progress") || stage.includes("in progress")) {
    return "sent"; // Active projects should be marked as sent
  }
  
  // Quote status mapping (more conservative)
  if (s.includes("sent") || s.includes("pending")) return "sent";
  if (s.includes("void")) return "void";
  if (s.includes("uncollectible")) return "overdue";
  if (s.includes("signed") || s.includes("accepted")) return "sent"; // Signed but not necessarily paid
  
  return "draft";
}

async function findPrimaryContactEmail(quote: HSQuote): Promise<string | null> {
  // Prefer direct contact association
  const contactId = quote.associations?.contacts?.results?.[0]?.id;
  if (contactId) {
    try {
      const c = await hsGet<{ properties?: { email?: string } }>(`/crm/v3/objects/contacts/${contactId}`, { properties: "email" });
      return c.properties?.email ?? null;
    } catch (error) {
      console.warn(`Failed to fetch contact ${contactId}:`, error);
    }
  }

  // Fallback: walk the first deal → first associated contact
  const dealId = quote.associations?.deals?.results?.[0]?.id;
  if (dealId) {
    try {
      const assoc = await hsGet<{ results?: { id: string }[] }>(`/crm/v3/objects/deals/${dealId}/associations/contacts`);
      const cid = assoc.results?.[0]?.id;
      if (cid) {
        const c = await hsGet<{ properties?: { email?: string } }>(`/crm/v3/objects/contacts/${cid}`, { properties: "email" });
        return c.properties?.email ?? null;
      }
    } catch (error) {
      console.warn(`Failed to fetch deal contacts for ${dealId}:`, error);
    }
  }

  return null;
}

async function fetchDealPayments(quote: HSQuote): Promise<{ total: number, subtotal: number, tax: number, payments: HSPayment[], dealStage?: string }> {
  try {
    // Get associated deal first
    const dealId = quote.associations?.deals?.results?.[0]?.id;
    if (!dealId) {
      console.log(`No deal associated with quote ${quote.id}`);
      return { total: 0, subtotal: 0, tax: 0, payments: [], dealStage: undefined };
    }

    // Get deal details including amount and stage
    const deal = await hsGet<{ 
      properties?: { 
        amount?: string;
        dealstage?: string;
        closedate?: string;
        hs_deal_stage_probability?: string;
        // Common payment tracking fields in HubSpot
        amount_paid?: string;
        payment_received?: string;
        remaining_balance?: string;
        payment_status?: string;
      } 
    }>(`/crm/v3/objects/deals/${dealId}`, {
      properties: "amount,dealstage,closedate,hs_deal_stage_probability,amount_paid,payment_received,remaining_balance,payment_status"
    });

    const dealAmount = parseFloat(deal.properties?.amount || '0');
    const amountPaid = parseFloat(deal.properties?.amount_paid || deal.properties?.payment_received || '0');
    const dealStage = deal.properties?.dealstage || '';
    
    console.log(`Deal ${dealId} details:`, {
      amount: dealAmount,
      stage: dealStage,
      amountPaid: amountPaid,
      paymentStatus: deal.properties?.payment_status,
      closeDate: deal.properties?.closedate,
      probability: deal.properties?.hs_deal_stage_probability
    });

    // Since HubSpot doesn't have a standard payments object, we'll track payments in custom properties
    // or rely on Stripe integration for actual payment tracking
    let payments: HSPayment[] = [];
    
    // If there's a recorded payment amount, create a mock payment record
    if (amountPaid > 0) {
      payments.push({
        id: `deal_${dealId}_payment`,
        amount: amountPaid.toString(),
        payment_date: deal.properties?.closedate || new Date().toISOString(),
        payment_method: 'hubspot_tracked',
        status: 'completed',
        currency_code: 'USD'
      });
    }
    
    return {
      total: dealAmount,
      subtotal: dealAmount, // HubSpot deals typically include tax in total
      tax: 0,
      payments,
      dealStage
    };
    
  } catch (error) {
    console.error(`Failed to fetch deal payments for quote ${quote.id}:`, error);
    return { total: 0, subtotal: 0, tax: 0, payments: [], dealStage: undefined };
  }
}

/**
 * GET /api/hubspot/backfill/quotes?limit=300&dry=0
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 300);
  const dry = url.searchParams.get("dry") === "1";

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
  const orgId = m?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  let after: string | undefined;
  let scanned = 0, upserts = 0, adopted = 0, createdClients = 0;

  while (scanned < limit) {
    const batch = await hsGet<HSListResp<HSQuote>>("/crm/v3/objects/quotes", {
      properties: "hs_title,hs_status,hs_total_amount,amount,hs_subtotal,hs_tax,hs_discount,createdate,hs_expiration_date,hs_payment_status,hs_public_url,hs_payment_terms,hs_payment_schedule,hs_template,hs_currency_code,deal_currency_code,hs_sender_firstname,hs_sender_lastname,hs_sender_email,hs_quote_signature,hs_signed_at,hs_esignature_signed_at",
      associations: "contacts,deals,line_items",
      limit: "100",
      after
    });

    if (!batch.results.length) break;
    for (const q of batch.results) {
      scanned++;

      const props = q.properties || {};
      const email = await findPrimaryContactEmail(q);
      let clientId: string | null = null;

      if (email) {
        // ensure client exists (by org + email)
        const { data: existing } = await supabase
          .from("clients")
          .select("id, name, phone, company")
          .eq("org_id", orgId)
          .eq("email", email)
          .maybeSingle();

        if (existing?.id) {
          clientId = existing.id;
          
          // Only update empty fields to preserve manual data
          if (!dry) {
            const updates: any = {};
            const quoteName = props.hs_title || email;
            
            if (!existing.name || existing.name.trim() === '' || existing.name === '—') {
              updates.name = quoteName;
            }
            
            // Only update if we have fields to update
            if (Object.keys(updates).length > 0) {
              await supabase
                .from("clients")
                .update(updates)
                .eq("id", existing.id);
            }
          }
        } else if (!dry) {
          const name = props.hs_title || email;
          const { data: created } = await supabase
            .from("clients")
            .insert({ org_id: orgId, name, email, status: 'Prospect' })
            .select("id")
            .single();
          if (created?.id) {
            clientId = created.id;
            createdClients++;
          }
        }
      }

      // Fetch deal payments and amounts
      let dealData: any = { total: 0, subtotal: 0, tax: 0, payments: [], dealStage: undefined };
      try {
        dealData = await fetchDealPayments(q);
      } catch (error) {
        console.log(`Could not fetch deal data for quote ${q.id}:`, error);
      }
      
      const amount = dealData.total || 0;
      const subtotal = dealData.subtotal || 0;
      const tax = dealData.tax || 0;
      const discount = 0;
      
      // Check if quote is signed
      const signedAt = props.hs_signed_at || props.hs_esignature_signed_at;
      const signerName = [props.hs_sender_firstname, props.hs_sender_lastname].filter(Boolean).join(' ');
      const signerEmail = props.hs_sender_email;
      
      // Calculate status before logging
      const status = mapStatus(props.hs_status, props.hs_payment_status, dealData.dealStage, dealData.payments.length > 0);
      
      console.log(`Quote ${q.id} final amounts:`, {
        title: props.hs_title,
        status: props.hs_status,
        paymentStatus: props.hs_payment_status,
        dealStage: dealData.dealStage,
        mappedStatus: status,
        signed: !!signedAt,
        signedAt,
        signerName,
        calculatedFromDeal: dealData.total > 0,
        amount,
        subtotal,
        tax,
        discount,
        dealPayments: dealData.payments.length,
        publicUrl: props.hs_public_url
      });
      
      const cents = Math.round(amount * 100);
      const subtotalCents = Math.round(subtotal * 100);
      const taxCents = Math.round(tax * 100);
      const discountCents = Math.round(discount * 100);

      if (!dry) {
        const { data: invoice, error } = await supabase.from("invoices").upsert({
          org_id: orgId,
          client_id: clientId,
          hubspot_quote_id: q.id,
          source: "hubspot",
          amount_cents: cents,
          subtotal_cents: subtotalCents,
          tax_cents: taxCents,
          discount_cents: discountCents,
          status,
          issued_at: props.createdate ? new Date(props.createdate).toISOString() : null,
          due_at: props.hs_expiration_date ? new Date(props.hs_expiration_date).toISOString() : null,
          signed_at: signedAt ? new Date(signedAt).toISOString() : null,
          signer_name: signerName || null,
          signer_email: signerEmail || null,
          signature_svg: props.hs_quote_signature || null,
          external_url: props.hs_public_url ?? null,
          description: props.hs_title ?? null,
          payment_terms: props.hs_payment_terms ?? null,
          payment_schedule: props.hs_payment_schedule ? JSON.stringify(props.hs_payment_schedule) : null,
          quote_template: props.hs_template ?? null,
          currency_code: props.hs_currency_code ?? props.deal_currency_code ?? 'USD',
          line_items: dealData.payments.length > 0 ? JSON.stringify(dealData.payments) : null,
          total_paid_cents: 0,
          remaining_balance_cents: cents
        }, { onConflict: "hubspot_quote_id" }).select('id').single();

        if (!error && invoice?.id) {
          upserts++;
          
          // Add HubSpot deal payments to invoice_payments table
          if (dealData.payments.length > 0) {
            for (const payment of dealData.payments) {
              const paymentAmount = Math.round(parseFloat(payment.amount || '0') * 100);
              if (paymentAmount > 0) {
                await supabase.from('invoice_payments').upsert({
                  invoice_id: invoice.id,
                  amount_cents: paymentAmount,
                  payment_method: payment.payment_method || 'hubspot',
                  paid_at: payment.payment_date ? new Date(payment.payment_date).toISOString() : new Date().toISOString(),
                  metadata: {
                    source: 'hubspot',
                    currency_code: payment.currency_code,
                    status: payment.status,
                    hubspot_payment_id: payment.id
                  }
                }, { onConflict: 'invoice_id,metadata' });
              }
            }
            console.log(`Added ${dealData.payments.length} HubSpot payments for quote ${q.id}`);
          }
        }
      } else {
        adopted++;
      }
    }

    after = batch.paging?.next?.after;
    if (!after) break;
  }

  return NextResponse.json({ scanned, upserts, createdClients, dry });
}
