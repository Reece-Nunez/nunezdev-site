/**
 * Admin endpoint: pull all subscriptions for a Stripe customer (or all
 * customers if no body provided) and run them through the same sync helper
 * the webhook uses. Useful for:
 *   - Bootstrapping subscriptions created before the webhook was configured
 *   - Recovering from webhook downtime or missed events
 *   - Repairing drift between Stripe and our mirror
 *
 * Auth: owner-only. Returns counts of synced/skipped/stale per customer.
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncSubscriptionFromStripe } from '@/lib/stripeSubscriptionSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BackfillBody {
  // If provided, only backfill subscriptions for this Stripe customer.
  stripeCustomerId?: string;
  // If provided, only backfill subscriptions for this local client (looks
  // up stripe_customer_id from clients table).
  clientId?: string;
}

export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const body = (await req.json().catch(() => ({}))) as BackfillBody;

  // Resolve target customers
  let customerIds: string[] = [];

  if (body.stripeCustomerId) {
    customerIds = [body.stripeCustomerId];
  } else if (body.clientId) {
    const supabase = supabaseAdmin();
    const { data: client } = await supabase
      .from('clients')
      .select('stripe_customer_id, org_id')
      .eq('id', body.clientId)
      .eq('org_id', guard.orgId)
      .single();
    if (!client?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Client not found or has no linked Stripe customer' },
        { status: 404 }
      );
    }
    customerIds = [client.stripe_customer_id];
  } else {
    // Backfill all clients with a stripe_customer_id in this org
    const supabase = supabaseAdmin();
    const { data: clients } = await supabase
      .from('clients')
      .select('stripe_customer_id')
      .eq('org_id', guard.orgId)
      .not('stripe_customer_id', 'is', null);
    customerIds = (clients || []).map((c) => c.stripe_customer_id).filter(Boolean) as string[];
  }

  if (customerIds.length === 0) {
    return NextResponse.json({ ok: true, customers: 0, totals: { synced: 0, skipped: 0, stale: 0 } });
  }

  const results: Record<string, { synced: number; skipped: number; stale: number; error?: string }> = {};
  const totals = { synced: 0, skipped: 0, stale: 0 };
  // Use the current time as the event timestamp — this is a manual backfill,
  // not a real webhook event. The stale guard will still respect any newer
  // last_event_at already in the table from real webhook deliveries.
  const eventCreatedAt = Math.floor(Date.now() / 1000);

  for (const customerId of customerIds) {
    const stats = { synced: 0, skipped: 0, stale: 0 };

    try {
      // Stripe paginates at 100 by default — sufficient for our scale
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
      });

      for (const sub of subs.data) {
        try {
          const result = await syncSubscriptionFromStripe(sub, { eventCreatedAt });
          stats[result] += 1;
          totals[result] += 1;
        } catch (err) {
          console.error('[backfill] sync failed', {
            customerId,
            subscriptionId: sub.id,
            err,
          });
          stats.skipped += 1;
          totals.skipped += 1;
        }
      }

      results[customerId] = stats;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[backfill] customer fetch failed', { customerId, err: message });
      results[customerId] = { ...stats, error: message };
    }
  }

  return NextResponse.json({
    ok: true,
    customers: customerIds.length,
    totals,
    perCustomer: results,
  });
}
