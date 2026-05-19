/**
 * Generates a Stripe Customer Portal session for a client.
 *
 * The Stripe Customer Portal is a hosted UI where the client can:
 *   - Update their payment method
 *   - View invoice history
 *   - Cancel or pause subscriptions
 *
 * Returns { url } that the caller opens in a new tab. The portal session
 * is single-use and expires after a few hours; always generate a fresh one.
 *
 * Auth: owner-only. The portal URL itself doesn't require the client to
 * sign in again — anyone with the link has access for its lifetime, so
 * we generate it on demand and don't persist it.
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
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
  const supabase = supabaseAdmin();

  const { data: client } = await supabase
    .from('clients')
    .select('id, stripe_customer_id')
    .eq('id', clientId)
    .eq('org_id', guard.orgId)
    .single();

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  if (!client.stripe_customer_id) {
    return NextResponse.json(
      { error: 'This client is not linked to a Stripe customer yet.' },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
  const returnUrl = `${baseUrl}/dashboard/clients/${clientId}`;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripe_customer_id,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Most common cause: Customer Portal not configured in Stripe Dashboard.
    // Check the structured error code first, fall back to message sniffing
    // for older SDK shapes.
    const errCode =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code?: string }).code
        : undefined;
    const message = err instanceof Error ? err.message : String(err);

    if (
      errCode === 'billing_portal_configuration_not_set' ||
      message.includes('No configuration provided')
    ) {
      return NextResponse.json(
        {
          error:
            "Stripe Customer Portal isn't configured yet. Set it up at https://dashboard.stripe.com/settings/billing/portal",
        },
        { status: 500 }
      );
    }
    console.error('[portal-session] Failed to create portal session', { err: message, code: errCode });
    return NextResponse.json(
      { error: 'Could not open billing portal. Please try again.' },
      { status: 500 }
    );
  }
}
