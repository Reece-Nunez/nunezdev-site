import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendBusinessNotification, sendPaymentReceipt, createNotification } from "@/lib/notifications";

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
      
      // First try to match against stripe_payment_link invoices
      const { data: stripeInvoices, error: stripeError } = await supabase
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

      console.log('[stripe-webhook] Stripe invoice query result:', {
        stripeInvoices,
        stripeError,
        queryParams: {
          amount_cents: paymentIntent.amount,
          customerEmail,
          status: ['sent', 'draft'],
          source: 'stripe_payment_link'
        }
      });

      if (stripeInvoices?.length === 1) {
        invoiceId = stripeInvoices[0].id;
        console.log(`[stripe-webhook] matched payment intent to stripe invoice by email/amount: ${invoiceId}`);
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
    
    // Final fallback: try finding by client and amount
    if (!invoiceId && clientId && orgId) {
      const { data: invoicesByAmount } = await supabase
        .from('invoices')
        .select('id')
        .eq('amount_cents', paymentIntent.amount)
        .eq('client_id', clientId)
        .eq('org_id', orgId)
        .in('status', ['sent', 'draft'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (invoicesByAmount?.length === 1) {
        invoiceId = invoicesByAmount[0].id;
        console.log(`[stripe-webhook] matched payment intent to invoice by client metadata and amount: ${invoiceId}`);
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
      } else {
        console.error('Failed to update installment status:', installmentError);
      }
    }

    // Guard against duplicate webhook deliveries — check if payment already recorded
    const { data: existingPayment } = await supabase
      .from('invoice_payments')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle();

    if (existingPayment) {
      console.log(`[stripe-webhook] Payment already recorded for intent ${paymentIntent.id}, skipping`);
      return;
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
        const clientName = (invoiceDetails.clients as any).name;
        const clientEmail = (invoiceDetails.clients as any).email;

        sendBusinessNotification('payment_received', {
          invoice_id: invoiceId,
          client_name: clientName,
          invoice_number: invoiceDetails.invoice_number,
          amount_cents: paymentIntent.amount,
          installment_label: installmentLabel,
          payment_method: paymentIntent.payment_method_types?.[0] || 'card'
        }).catch(err => console.error('[stripe-webhook] Business notification error:', err));

        // Send payment receipt to client (fire-and-forget to avoid blocking Stripe response)
        if (clientEmail) {
          (async () => {
            const { data: invoiceTotals } = await supabase
              .from('invoices')
              .select('amount_cents, total_paid_cents, remaining_balance_cents')
              .eq('id', invoiceId)
              .single();

            await sendPaymentReceipt({
              invoice_id: invoiceId,
              invoice_number: invoiceDetails.invoice_number,
              client_name: clientName,
              client_email: clientEmail,
              amount_cents: paymentIntent.amount,
              total_paid_cents: invoiceTotals?.total_paid_cents || paymentIntent.amount,
              invoice_total_cents: invoiceTotals?.amount_cents || undefined,
              remaining_balance_cents: invoiceTotals?.remaining_balance_cents ?? undefined,
              payment_method: paymentIntent.payment_method_types?.[0] || 'card',
              payment_date: new Date().toISOString(),
              installment_label: installmentId ? installmentLabel : undefined,
              transaction_id: paymentIntent.id,
            });
          })().catch(err => console.error('[stripe-webhook] Client receipt error:', err));
        }
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

      // Create in-app notification
      if (orgId && invoiceDetails) {
        const clientName = (invoiceDetails.clients as any).name;
        const amountFmt = `$${(paymentIntent.amount / 100).toFixed(2)}`;
        createNotification({
          orgId,
          type: 'invoice_paid',
          title: `Payment received from ${clientName}`,
          body: `${invoiceDetails.invoice_number}${installmentLabel ? ` - ${installmentLabel}` : ''} - ${amountFmt}`,
          link: `/dashboard/invoices/${invoiceId}`,
        }).catch(err => console.error('[stripe-webhook] In-app notification error:', err));
      }

      // Emit realtime event for SSE subscribers
      if (orgId) {
        await supabase
          .from('realtime_events')
          .insert({
            org_id: orgId,
            event_type: installmentId ? 'installment_paid' : 'payment_received',
            invoice_id: invoiceId,
            client_id: clientId,
            event_data: {
              invoice_id: invoiceId,
              invoice_number: invoiceDetails?.invoice_number,
              client_name: invoiceDetails ? (invoiceDetails.clients as any).name : null,
              amount_cents: paymentIntent.amount,
              installment_id: installmentId || null,
              installment_label: installmentLabel,
              payment_method: paymentIntent.payment_method_types?.[0] || 'card'
            }
          });
        console.log(`[stripe-webhook] emitted realtime event for payment on invoice ${invoiceId}`);
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

async function handleChargeSucceeded(charge: Stripe.Charge, stripe: Stripe) {
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

    // Retrieve Stripe fee from balance transaction and store it
    if (charge.balance_transaction) {
      try {
        const balanceTxnId = typeof charge.balance_transaction === 'string'
          ? charge.balance_transaction
          : charge.balance_transaction.id;
        const balanceTxn = await stripe.balanceTransactions.retrieve(balanceTxnId);
        const feeCents = balanceTxn.fee || 0;

        if (feeCents > 0) {
          const { error: feeError } = await supabase
            .from('invoice_payments')
            .update({ stripe_fee_cents: feeCents })
            .eq('stripe_payment_intent_id', charge.payment_intent);

          if (!feeError) {
            console.log(`[stripe-webhook] stored fee ${feeCents} cents for payment intent ${charge.payment_intent}`);
          } else {
            console.error(`[stripe-webhook] failed to store fee:`, feeError);
          }
        }
      } catch (err) {
        console.error(`[stripe-webhook] failed to retrieve balance transaction:`, err);
      }
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
        bodyLength: bodyBuffer.length,
        hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET
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
      await handleChargeSucceeded(charge, stripe);
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
