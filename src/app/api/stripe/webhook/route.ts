import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendBusinessNotification } from "@/lib/notifications";

async function autoUpdateDealStage(supabase: any, dealId?: string, clientId?: string, orgId?: string) {
  try {
    // If we have a specific deal ID, update that deal
    if (dealId && orgId) {
      const { data: deal } = await supabase
        .from("deals")
        .select(`
          id,
          value_cents,
          stage,
          client_id,
          invoices:invoices!client_id (
            amount_cents,
            status,
            invoice_payments (
              amount_cents
            )
          )
        `)
        .eq("id", dealId)
        .eq("org_id", orgId)
        .single();

      if (deal) {
        await checkAndUpdateDealStage(supabase, deal);
      }
    }
    // If we only have client ID, update all their open deals
    else if (clientId && orgId) {
      const { data: deals } = await supabase
        .from("deals")
        .select(`
          id,
          value_cents,
          stage,
          client_id,
          invoices:invoices!client_id (
            amount_cents,
            status,
            invoice_payments (
              amount_cents
            )
          )
        `)
        .eq("client_id", clientId)
        .eq("org_id", orgId)
        .not("stage", "in", '("Won","Lost","Abandoned")');

      if (deals) {
        for (const deal of deals) {
          await checkAndUpdateDealStage(supabase, deal);
        }
      }
    }
  } catch (error) {
    console.error("[stripe-webhook] Error in autoUpdateDealStage:", error);
  }
}

async function checkAndUpdateDealStage(supabase: any, deal: any) {
  // Calculate total paid vs deal value
  let totalPaid = 0;
  
  deal.invoices?.forEach((invoice: any) => {
    invoice.invoice_payments?.forEach((payment: any) => {
      totalPaid += payment.amount_cents || 0;
    });
  });

  // Auto-update stage if fully paid and not already Won/Lost/Abandoned
  const shouldMarkWon = totalPaid >= deal.value_cents && 
                       !['Won', 'Lost', 'Abandoned'].includes(deal.stage);
  
  if (shouldMarkWon) {
    const { error } = await supabase
      .from("deals")
      .update({ 
        stage: "Won",
        updated_at: new Date().toISOString()
      })
      .eq("id", deal.id);
      
    if (!error) {
      console.log(`[stripe-webhook] Auto-updated deal ${deal.id} to Won stage (paid: ${totalPaid}, value: ${deal.value_cents})`);
    }
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Moved Stripe initialization to function level to avoid build-time issues

function mapStatus(s?: Stripe.Invoice.Status | null) {
  switch (s) {
    case "draft": return "draft";
    case "open": return "sent";
    case "paid": return "paid";
    case "void": return "void";
    case "uncollectible": return "overdue";
    default: return "draft";
  }
}

async function upsertInvoiceFromStripe(si: Stripe.Invoice) {
  const supabase = supabaseAdmin();

  const newStatus = mapStatus(si.status);
  const amountCents = (si.total ?? si.amount_due ?? 0);
  const issuedISO = si.status_transitions?.finalized_at
    ? new Date(si.status_transitions.finalized_at * 1000).toISOString()
    : null;
  const dueISO = si.due_date ? new Date(si.due_date * 1000).toISOString() : null;

  const md = (si.metadata || {}) as Record<string, string>;
  const mdOrg = md.orgId || null;
  const mdClient = md.clientId || null;

  // Read existing row (if any)
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, org_id, client_id, status")
    .eq("stripe_invoice_id", si.id)
    .maybeSingle();

  // Guard: never downgrade (paid -> sent/overdue/etc.)
  if (existing?.status === "paid" && newStatus !== "paid") {
    console.log("[stripe-webhook] skip downgrade", {
      stripe_invoice_id: si.id, existing: existing.status, incoming: newStatus
    });
    return existing.id;
  }

  // Decide effective org/client
  const org_id = mdOrg ?? existing?.org_id ?? null;
  const client_id = mdClient ?? existing?.client_id ?? null;

  const updatePayload = {
    status: newStatus,
    amount_cents: amountCents,
    issued_at: issuedISO,
    due_at: dueISO,
  };

  // If we have org/client (from metadata or existing), perform an upsert.
  if (org_id && client_id) {
    const { data, error } = await supabase
      .from("invoices")
      .upsert(
        { org_id, client_id, stripe_invoice_id: si.id, ...updatePayload },
        { onConflict: "stripe_invoice_id" }
      )
      .select("id")
      .single();
    if (error) throw error;
    console.log("[stripe-webhook] upserted", { stripe_invoice_id: si.id, status: newStatus });
    return data?.id;
  }

  // Otherwise, attempt plain UPDATE of the found row
  if (existing?.id) {
    const { error } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", existing.id);
    if (error) throw error;
    console.log("[stripe-webhook] updated", { stripe_invoice_id: si.id, status: newStatus });
    return existing.id;
  }

  // As a last resort, try insert with null org/client (only if your schema allows)
  // If your schema requires org_id NOT NULL, skip this.
  console.log("[stripe-webhook] no existing row found and no metadata; skipping insert", { stripe_invoice_id: si.id });
  return null;
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const supabase = supabaseAdmin();
  console.log("[stripe-webhook] payment_intent.succeeded", paymentIntent.id);

  // Try to find invoice by metadata
  const metadata = paymentIntent.metadata || {};
  let invoiceId = metadata.invoice_id || metadata.hubspot_quote_id;
  const installmentId = metadata.installment_id; // For payment plan installments
  const dealId = metadata.deal_id;
  const clientId = metadata.client_id;
  const orgId = metadata.org_id;

  // If no direct invoice ID, try to match by amount and external_url/hubspot_quote_id
  if (!invoiceId) {
    console.log('[stripe-webhook] No invoice ID in metadata, attempting fallback matching');
    
    // Try to find by amount and customer email
    let customerEmail: string | null = null;
    
    if (paymentIntent.customer && typeof paymentIntent.customer === 'string') {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const customer = await stripe.customers.retrieve(paymentIntent.customer);
        if ('email' in customer) {
          customerEmail = customer.email;
        }
      } catch (error) {
        console.warn('Failed to fetch customer:', error);
      }
    }

    // Try receipt email as fallback
    customerEmail = customerEmail || paymentIntent.receipt_email;

    console.log('[stripe-webhook] Fallback matching with:', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      customerEmail,
      hasCustomer: !!paymentIntent.customer,
      receiptEmail: paymentIntent.receipt_email
    });

    if (customerEmail) {
      // Try different email variations (handle common email differences)
      const emailVariations = [
        customerEmail,
        customerEmail.replace('@gmail.com', '@nunezdev.com'), // reecenunez20@gmail.com -> reecenunez20@nunezdev.com
        customerEmail.replace(/\d+@/, '@'),                    // reecenunez20@gmail.com -> reecenunez@gmail.com  
        customerEmail.replace(/^\w+/, 'reece'),                // reecenunez20@gmail.com -> reece@gmail.com
        customerEmail.replace(/^\w+/, 'reece').replace('@gmail.com', '@nunezdev.com') // -> reece@nunezdev.com
      ];
      
      console.log('[stripe-webhook] Trying email variations:', emailVariations);
      
      // First try to match against deal payments (stripe_payment_link source)
      const { data: dealInvoices, error: dealError } = await supabase
        .from('invoices')
        .select(`
          id,
          client_id,
          source,
          status,
          clients!inner(email)
        `)
        .eq('amount_cents', paymentIntent.amount)
        .in('clients.email', emailVariations)
        .in('status', ['sent', 'draft'])
        .eq('source', 'stripe_payment_link');

      console.log('[stripe-webhook] Deal invoice query result:', {
        dealInvoices,
        dealError,
        queryParams: {
          amount_cents: paymentIntent.amount,
          customerEmail,
          status: ['sent', 'draft'],
          source: 'stripe_payment_link'
        }
      });

      if (dealInvoices?.length === 1) {
        invoiceId = dealInvoices[0].id;
        console.log(`[stripe-webhook] matched payment intent to deal invoice by email/amount: ${invoiceId}`);
      } else {
        // Fallback to hubspot invoices
        const { data: hubspotInvoices, error: hubspotError } = await supabase
          .from('invoices')
          .select(`
            id,
            client_id,
            source,
            status,
            clients!inner(email)
          `)
          .eq('amount_cents', paymentIntent.amount)
          .in('clients.email', emailVariations)
          .in('status', ['sent', 'draft'])
          .eq('source', 'hubspot');

        console.log('[stripe-webhook] Hubspot invoice query result:', {
          hubspotInvoices,
          hubspotError,
          queryParams: {
            amount_cents: paymentIntent.amount,
            customerEmail,
            status: ['sent', 'draft'],
            source: 'hubspot'
          }
        });

        if (hubspotInvoices?.length === 1) {
          invoiceId = hubspotInvoices[0].id;
          console.log(`[stripe-webhook] matched payment intent to hubspot invoice by email/amount: ${invoiceId}`);
        } else {
          // Try without source filter as final fallback
          console.log('[stripe-webhook] Trying final fallback without source filter');
          const { data: anyInvoices, error: anyError } = await supabase
            .from('invoices')
            .select(`
              id,
              client_id,
              source,
              status,
              clients!inner(email)
            `)
            .eq('amount_cents', paymentIntent.amount)
            .in('clients.email', emailVariations)
            .in('status', ['sent', 'draft']);

          console.log('[stripe-webhook] Final fallback query result:', {
            anyInvoices,
            anyError,
            queryParams: {
              amount_cents: paymentIntent.amount,
              customerEmail,
              status: ['sent', 'draft']
            }
          });

          if (anyInvoices?.length === 1) {
            invoiceId = anyInvoices[0].id;
            console.log(`[stripe-webhook] matched payment intent to invoice by email/amount (no source): ${invoiceId}`);
          }
        }
      }
    }
    
    // Final fallback: if we have deal metadata but still no invoice, try finding by deal and amount
    if (!invoiceId && dealId && clientId && orgId) {
      const { data: dealInvoicesByAmount } = await supabase
        .from('invoices')
        .select('id')
        .eq('amount_cents', paymentIntent.amount)
        .eq('client_id', clientId)
        .eq('org_id', orgId)
        .in('status', ['sent', 'draft'])
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (dealInvoicesByAmount?.length === 1) {
        invoiceId = dealInvoicesByAmount[0].id;
        console.log(`[stripe-webhook] matched payment intent to invoice by deal metadata and amount: ${invoiceId}`);
      }
    }
  }

  if (invoiceId) {
    // Handle payment plan installment payments
    if (installmentId) {
      // Update the specific installment status
      const { error: installmentError } = await supabase
        .from('invoice_payment_plans')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent.id
        })
        .eq('id', installmentId);

      if (!installmentError) {
        console.log(`[stripe-webhook] updated payment plan installment ${installmentId} as paid`);
        
        // Add activity log for installment payment
        await supabase
          .from('client_activity_log')
          .insert({
            invoice_id: invoiceId,
            client_id: clientId,
            activity_type: 'payment_completed',
            activity_data: {
              installment_id: installmentId,
              amount_cents: paymentIntent.amount,
              payment_intent_id: paymentIntent.id
            }
          });
      } else {
        console.error('Failed to update installment status:', installmentError);
      }
    }

    // Add payment record for all payments (installment or full)
    const { error: paymentError } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: invoiceId,
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: paymentIntent.amount,
        payment_method: paymentIntent.payment_method_types?.[0] || 'card',
        paid_at: new Date().toISOString(),
        metadata: {
          payment_intent_id: paymentIntent.id,
          installment_id: installmentId || null,
          customer: paymentIntent.customer,
          receipt_email: paymentIntent.receipt_email
        }
      });

    if (!paymentError) {
      console.log(`[stripe-webhook] added payment record for invoice ${invoiceId} with payment intent ${paymentIntent.id}`);
      
      // Get client and invoice details for notifications
      const { data: invoiceDetails } = await supabase
        .from('invoices')
        .select(`
          invoice_number,
          clients!inner(name, email)
        `)
        .eq('id', invoiceId)
        .single();

      // Get installment details if this was an installment payment
      let installmentLabel = 'Payment';
      if (installmentId) {
        const { data: installmentData } = await supabase
          .from('invoice_payment_plans')
          .select('installment_label')
          .eq('id', installmentId)
          .single();
        
        if (installmentData) {
          installmentLabel = installmentData.installment_label;
        }
      }
      
      // Send business notification for payment received
      if (invoiceDetails) {
        await sendBusinessNotification('payment_received', {
          invoice_id: invoiceId,
          client_name: (invoiceDetails.clients as any).name,
          invoice_number: invoiceDetails.invoice_number,
          amount_cents: paymentIntent.amount,
          installment_label: installmentLabel,
          payment_method: paymentIntent.payment_method_types?.[0] || 'card'
        });
      }
      
      // Add activity log
      await supabase
        .from('client_activity_log')
        .insert({
          invoice_id: invoiceId,
          client_id: clientId,
          activity_type: 'payment_completed',
          activity_data: {
            amount_cents: paymentIntent.amount,
            payment_intent_id: paymentIntent.id,
            installment_id: installmentId || null
          }
        });
      
      // Check if we should auto-update deal stage
      if (dealId || clientId) {
        await autoUpdateDealStage(supabase, dealId, clientId, orgId);
      }
      
      // The trigger will automatically update the invoice status based on total payments
    } else {
      console.error('Failed to add payment record:', paymentError);
      
      // Fallback to old method if payment table insert fails
      const { error: fallbackError } = await supabase
        .from('invoices')
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: paymentIntent.payment_method_types?.[0] || 'card'
        })
        .eq('id', invoiceId);
        
      if (fallbackError) {
        console.error('Fallback update also failed:', fallbackError);
      }
    }
  } else {
    console.warn(`[stripe-webhook] could not match payment intent ${paymentIntent.id} to any invoice`);
  }
}

async function handleChargeSucceeded(charge: Stripe.Charge) {
  const supabase = supabaseAdmin();
  console.log("[stripe-webhook] charge.succeeded", charge.id);

  if (charge.payment_intent) {
    // Link charge to existing payment intent
    const { error } = await supabase
      .from('invoices')
      .update({
        stripe_charge_id: charge.id,
      })
      .eq('stripe_payment_intent_id', charge.payment_intent);

    if (!error) {
      console.log(`[stripe-webhook] linked charge ${charge.id} to payment intent ${charge.payment_intent}`);
    }
  }
}

export async function POST(req: Request) {
  console.log('[stripe-webhook] === WEBHOOK REQUEST RECEIVED ===');

  try {
    // Initialize Stripe
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[stripe-webhook] STRIPE_SECRET_KEY not found');
      return NextResponse.json({ error: 'Missing Stripe configuration' }, { status: 500 });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not found');
      return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('[stripe-webhook] Stripe initialized successfully');

    const sig = req.headers.get("stripe-signature");
    console.log('[stripe-webhook] Signature header present:', !!sig);

    // AWS Amplify specific handling: get the raw body
    let bodyBuffer: Buffer;

    // Check if body is already parsed by AWS Amplify middleware
    const contentType = req.headers.get('content-type');
    console.log('[stripe-webhook] Content-Type:', contentType);

    try {
      // For AWS Amplify, we need to handle the body more carefully
      if (contentType?.includes('application/json')) {
        // If content-type suggests JSON, try to get the raw bytes
        const body = await req.arrayBuffer();
        bodyBuffer = Buffer.from(body);
        console.log('[stripe-webhook] Got body via arrayBuffer, length:', bodyBuffer.length);
      } else {
        // Fallback to text for other content types
        const bodyText = await req.text();
        bodyBuffer = Buffer.from(bodyText, 'utf8');
        console.log('[stripe-webhook] Got body via text, length:', bodyBuffer.length);
      }
    } catch (error) {
      console.error('[stripe-webhook] Error reading body (first attempt):', error);
      // Final fallback
      try {
        const bodyText = await req.text();
        bodyBuffer = Buffer.from(bodyText, 'utf8');
        console.log('[stripe-webhook] Got body via fallback text, length:', bodyBuffer.length);
      } catch (finalError) {
        console.error('[stripe-webhook] Failed to read request body (final):', finalError);
        return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
      }
    }

    // Add debug logging for AWS Amplify debugging
    console.log('[stripe-webhook] Debug info:', {
      hasSignature: !!sig,
      bodyLength: bodyBuffer.length,
      contentType,
      isAmplify: process.env.AWS_REGION ? true : false,
      signaturePreview: sig?.substring(0, 50) + '...'
    });

    if (!sig) {
      console.error('[stripe-webhook] No stripe-signature header found');
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      console.log('[stripe-webhook] Attempting to construct event...');
      event = stripe.webhooks.constructEvent(bodyBuffer, sig, process.env.STRIPE_WEBHOOK_SECRET);
      console.log('[stripe-webhook] Event constructed successfully, type:', event.type);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[stripe-webhook] Signature verification failed:', {
        error: message,
        signatureHeader: sig,
        bodyLength: bodyBuffer.length,
        bodyPreview: bodyBuffer.toString().substring(0, 100),
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) + '...'
      });
      return NextResponse.json({ error: `Webhook signature failed: ${message}` }, { status: 400 });
    }

    // Process the webhook event
    console.log('[stripe-webhook] Processing webhook event...');

    const interesting = new Set([
      "invoice.finalized",
      "invoice.updated",
      "invoice.sent",
      "invoice.paid",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
      "invoice.voided",
      "invoice.marked_uncollectible",
      "invoice.deleted",
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "charge.succeeded",
    ]);

    if (!interesting.has(event.type)) {
      console.log('[stripe-webhook] Event type not interesting, ignoring:', event.type);
      return NextResponse.json({ ignored: event.type });
    }

    console.log("[stripe-webhook] Processing event:", event.type);

    // Handle payment intents (for HubSpot quote payments)
    if (event.type === "payment_intent.succeeded") {
      console.log('[stripe-webhook] Handling payment_intent.succeeded');
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentSucceeded(paymentIntent);
      console.log('[stripe-webhook] payment_intent.succeeded handled successfully');
      return NextResponse.json({ ok: true });
    }

    if (event.type === "charge.succeeded") {
      console.log('[stripe-webhook] Handling charge.succeeded');
      const charge = event.data.object as Stripe.Charge;
      await handleChargeSucceeded(charge);
      console.log('[stripe-webhook] charge.succeeded handled successfully');
      return NextResponse.json({ ok: true });
    }

    if (event.type === "invoice.deleted") {
      console.log('[stripe-webhook] Handling invoice.deleted');
      const inv = event.data.object as Stripe.Invoice;
      const supabase = supabaseAdmin();
      await supabase.from("invoices").delete().eq("stripe_invoice_id", inv.id);
      console.log('[stripe-webhook] invoice.deleted handled successfully');
      return NextResponse.json({ ok: true });
    }

    console.log('[stripe-webhook] Handling invoice event');
    const inv = event.data.object as Stripe.Invoice;
    await upsertInvoiceFromStripe(inv);
    console.log('[stripe-webhook] Invoice event handled successfully');

    return NextResponse.json({ ok: true });

  } catch (e: unknown) {
    console.error("[stripe-webhook] CRITICAL ERROR:", e);
    console.error("[stripe-webhook] Error stack:", e instanceof Error ? e.stack : "No stack");
    const message = e instanceof Error ? e.message : "Webhook handler error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
