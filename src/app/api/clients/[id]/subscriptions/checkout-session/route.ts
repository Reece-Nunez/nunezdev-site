/**
 * Create a Stripe Checkout session for a new subscription on this client.
 *
 * Flow:
 *   1. Look up the client; create a Stripe customer if not yet linked
 *   2. Create a Checkout session in subscription mode for the chosen price
 *   3. Return the hosted Checkout URL; the caller opens it in a new tab
 *   4. Client completes checkout → Stripe fires customer.subscription.created
 *      → our webhook mirrors it into client_subscriptions
 *
 * Owner-only. Stamps metadata { client_id, org_id } on both the session
 * and the subscription so the webhook can resolve the local client even
 * if customer linkage drifts.
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  priceId?: string;
  quantity?: number;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { id: clientId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as RequestBody;

  if (!body.priceId || typeof body.priceId !== 'string') {
    return NextResponse.json(
      { error: 'priceId is required' },
      { status: 400 }
    );
  }
  const quantity = Number.isInteger(body.quantity) && body.quantity! > 0 ? body.quantity! : 1;

  const supabase = supabaseAdmin();

  // Verify client + grab/create their Stripe customer
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email, stripe_customer_id')
    .eq('id', clientId)
    .eq('org_id', guard.orgId)
    .single();

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  let stripeCustomerId = client.stripe_customer_id;
  if (!stripeCustomerId) {
    try {
      const customerParams: Stripe.CustomerCreateParams = {
        name: client.name,
        email: client.email ?? undefined,
        metadata: {
          client_id: client.id,
          org_id: guard.orgId!,
        },
      };
      // Idempotency key: Stripe returns the same customer if this fires
      // twice within 24h (e.g., concurrent requests), preventing duplicate
      // customers from races.
      const customer = await stripe.customers.create(customerParams, {
        idempotencyKey: `client-customer-${client.id}`,
      });
      stripeCustomerId = customer.id;
      await supabase
        .from('clients')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', client.id);
    } catch (err) {
      console.error('[checkout-session] customer.create failed', err);
      return NextResponse.json(
        { error: 'Could not create Stripe customer for this client.' },
        { status: 500 }
      );
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';

  try {
    // Idempotency bucket: same client + price + price-id-day yields the same
    // session if a double-click or retry happens. Avoids creating two
    // identical Checkout sessions (and thus two potential subscriptions if
    // the customer accidentally pays both).
    const dayBucket = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `checkout-${client.id}-${body.priceId}-${dayBucket}`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: body.priceId, quantity }],
        // Stamp metadata so the webhook can resolve via fallback even if
        // customer linkage is ever cleared/replaced locally. We never trust
        // org_id from metadata on the receiving side — it's pulled from the
        // resolved client row.
        metadata: {
          client_id: client.id,
          org_id: guard.orgId!,
          source: 'crm_new_subscription',
        },
        subscription_data: {
          metadata: {
            client_id: client.id,
            org_id: guard.orgId!,
            source: 'crm_new_subscription',
          },
        },
        success_url: `${baseUrl}/dashboard/clients/${client.id}?subscription=success`,
        cancel_url: `${baseUrl}/dashboard/clients/${client.id}?subscription=canceled`,
      },
      { idempotencyKey }
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[checkout-session] session.create failed', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Stripe rejected the checkout request: ${message}` },
      { status: 500 }
    );
  }
}
