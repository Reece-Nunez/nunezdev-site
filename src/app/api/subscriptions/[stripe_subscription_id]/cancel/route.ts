/**
 * Toggle a subscription's cancel_at_period_end flag in Stripe.
 *
 * Body: { cancel_at_period_end: boolean }
 *   true  → subscription stops billing at the end of the current period
 *   false → undo a scheduled cancellation
 *
 * We trust Stripe to be the source of truth; the local mirror updates
 * itself when Stripe fires customer.subscription.updated.
 *
 * Auth: owner-only, scoped via client_subscriptions lookup to prevent
 * canceling subscriptions in a different org.
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  context: { params: Promise<{ stripe_subscription_id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { stripe_subscription_id: stripeSubId } = await context.params;
  const body = await req.json().catch(() => ({}));

  // Reject malformed payloads — a missing field shouldn't silently flip the
  // subscription to active.
  if (typeof body.cancel_at_period_end !== 'boolean') {
    return NextResponse.json(
      { error: 'cancel_at_period_end must be true or false' },
      { status: 400 }
    );
  }
  const cancelAtPeriodEnd: boolean = body.cancel_at_period_end;

  // Verify the subscription belongs to this org via our mirror. Filtering
  // at the DB level (not via post-fetch comparison) avoids relying on any
  // uniqueness assumption about stripe_subscription_id across rows.
  const supabase = supabaseAdmin();
  const { data: mirror } = await supabase
    .from('client_subscriptions')
    .select('id, status')
    .eq('stripe_subscription_id', stripeSubId)
    .eq('org_id', guard.orgId)
    .maybeSingle();

  if (!mirror) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  if (mirror.status === 'canceled' || mirror.status === 'incomplete_expired') {
    return NextResponse.json(
      { error: 'This subscription is already canceled.' },
      { status: 400 }
    );
  }

  try {
    const updated = await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
    // Mirror updates via webhook (customer.subscription.updated). We don't
    // mutate the local row here to keep Stripe as the single source of truth.
    return NextResponse.json({
      ok: true,
      stripe_subscription_id: updated.id,
      cancel_at_period_end: updated.cancel_at_period_end,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[subscription-cancel] Stripe update failed', { stripeSubId, err: message });
    return NextResponse.json(
      { error: `Stripe rejected the change: ${message}` },
      { status: 500 }
    );
  }
}
