import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
  const dealId = metadata.deal_id;
  const clientId = metadata.client_id;
  const orgId = metadata.org_id;

  // If no direct invoice ID, try to match by amount and external_url/hubspot_quote_id
  if (!invoiceId) {
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

    if (customerEmail) {
      // First try to match against deal payments (stripe_payment_link source)
      const { data: dealInvoices } = await supabase
        .from('invoices')
        .select(`
          id,
          client_id,
          clients!inner(email)
        `)
        .eq('amount_cents', paymentIntent.amount)
        .eq('clients.email', customerEmail)
        .in('status', ['sent', 'draft'])
        .eq('source', 'stripe_payment_link');

      if (dealInvoices?.length === 1) {
        invoiceId = dealInvoices[0].id;
        console.log(`[stripe-webhook] matched payment intent to deal invoice by email/amount: ${invoiceId}`);
      } else {
        // Fallback to hubspot invoices
        const { data: hubspotInvoices } = await supabase
          .from('invoices')
          .select(`
            id,
            client_id,
            clients!inner(email)
          `)
          .eq('amount_cents', paymentIntent.amount)
          .eq('clients.email', customerEmail)
          .in('status', ['sent', 'draft'])
          .eq('source', 'hubspot');

        if (hubspotInvoices?.length === 1) {
          invoiceId = hubspotInvoices[0].id;
          console.log(`[stripe-webhook] matched payment intent to hubspot invoice by email/amount: ${invoiceId}`);
        }
      }
    }
  }

  if (invoiceId) {
    // Add payment record instead of directly updating invoice status
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
          customer: paymentIntent.customer,
          receipt_email: paymentIntent.receipt_email
        }
      });

    if (!paymentError) {
      console.log(`[stripe-webhook] added payment record for invoice ${invoiceId} with payment intent ${paymentIntent.id}`);
      
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
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Webhook signature failed: ${message}` }, { status: 400 });
  }

  try {
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
      return NextResponse.json({ ignored: event.type });
    }

    console.log("[stripe-webhook] event", event.type);

    // Handle payment intents (for HubSpot quote payments)
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentSucceeded(paymentIntent);
      return NextResponse.json({ ok: true });
    }

    if (event.type === "charge.succeeded") {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeSucceeded(charge);
      return NextResponse.json({ ok: true });
    }

    if (event.type === "invoice.deleted") {
      const inv = event.data.object as Stripe.Invoice;
      const supabase = supabaseAdmin();
      await supabase.from("invoices").delete().eq("stripe_invoice_id", inv.id);
      return NextResponse.json({ ok: true });
    }

    const inv = event.data.object as Stripe.Invoice;
    await upsertInvoiceFromStripe(inv);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("[stripe-webhook] error", e);
    const message = e instanceof Error ? e.message : "Webhook handler error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
