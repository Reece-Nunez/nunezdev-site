import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Resolve the local client_id for a Stripe subscription.
 *
 * Priority:
 *   1. clients.stripe_customer_id mapping (the authoritative link)
 *   2. metadata.client_id fallback — but we still verify the client actually
 *      exists in the named org. Stripe metadata is user-controlled and must
 *      not be trusted blindly.
 *
 * Returns null if no local client owns this subscription.
 */
async function resolveClient(
  sub: Stripe.Subscription
): Promise<{ orgId: string; clientId: string } | null> {
  const supabase = supabaseAdmin();

  // 1. Customer-id mapping (authoritative)
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (customerId) {
    const { data } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data) return { orgId: data.org_id, clientId: data.id };
  }

  // 2. Metadata fallback — verified against the actual client row, not trusted directly.
  const md = (sub.metadata || {}) as Record<string, string>;
  if (md.client_id) {
    const { data } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', md.client_id)
      .maybeSingle();
    // We use the authoritative org_id from the DB, not what metadata claims.
    if (data) return { orgId: data.org_id, clientId: data.id };
  }

  return null;
}

function toIsoOrNull(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Extract billing-period dates from the subscription. As of Stripe API
 * 2025-07-30.basil these live on the subscription item, not the subscription.
 * We snapshot the first item's period (multi-item subs aren't a real-world
 * case for retainers yet).
 */
function getPeriodDates(sub: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const item = sub.items.data[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | undefined;
  return {
    start: toIsoOrNull(item?.current_period_start),
    end: toIsoOrNull(item?.current_period_end),
  };
}

/**
 * Record a subscription we don't recognize so we can investigate without
 * spamming logs on every retry.
 */
async function recordUnknownSubscription(sub: Stripe.Subscription): Promise<void> {
  const supabase = supabaseAdmin();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
  const metadataKeys = Object.keys(sub.metadata || {});

  // Upsert with seen_count increment via raw SQL since Supabase upsert can't
  // do arithmetic. Two-step: try update first, insert if missing.
  const { data: existing } = await supabase
    .from('stripe_unknown_subscriptions')
    .select('seen_count')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('stripe_unknown_subscriptions')
      .update({
        last_seen_at: new Date().toISOString(),
        seen_count: (existing.seen_count || 0) + 1,
        stripe_customer_id: customerId,
        metadata_keys: metadataKeys,
      })
      .eq('stripe_subscription_id', sub.id);
  } else {
    await supabase.from('stripe_unknown_subscriptions').insert({
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      metadata_keys: metadataKeys,
    });
    // Only warn-log on FIRST encounter so retries don't flood logs.
    console.warn('[subscription-sync] Unknown subscription (no matching client)', {
      subscriptionId: sub.id,
      customerId,
      metadataKeys, // keys only, never values (may hold PII)
    });
  }
}

interface SyncOptions {
  /**
   * Unix timestamp (seconds) when Stripe created this webhook event.
   * Used to detect out-of-order delivery and refuse stale updates.
   */
  eventCreatedAt: number;
}

/**
 * Upsert a Stripe subscription into our mirror table.
 *
 * Idempotent and out-of-order safe — refuses to apply an update whose
 * event timestamp is older than what we already have for this subscription.
 *
 * Returns:
 *   - 'synced'   — row inserted or updated
 *   - 'skipped'  — couldn't resolve the client (recorded in dead-letter table)
 *   - 'stale'    — incoming event is older than what we already have
 */
export async function syncSubscriptionFromStripe(
  sub: Stripe.Subscription,
  opts: SyncOptions
): Promise<'synced' | 'skipped' | 'stale'> {
  const supabase = supabaseAdmin();

  const resolved = await resolveClient(sub);
  if (!resolved) {
    await recordUnknownSubscription(sub);
    return 'skipped';
  }

  // A subscription always has at least one item; bail loudly if not.
  const item = sub.items.data[0];
  const price = item?.price;
  if (!price?.recurring) {
    console.warn('[subscription-sync] Subscription missing recurring price', {
      subscriptionId: sub.id,
    });
    return 'skipped';
  }

  // Out-of-order guard: read the current last_event_at, refuse if stale.
  const eventCreatedISO = new Date(opts.eventCreatedAt * 1000).toISOString();
  const { data: existing } = await supabase
    .from('client_subscriptions')
    .select('last_event_at')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();

  if (existing?.last_event_at && existing.last_event_at >= eventCreatedISO) {
    console.log('[subscription-sync] Skipping stale event', {
      subscriptionId: sub.id,
      eventCreatedISO,
      existingLastEventAt: existing.last_event_at,
    });
    return 'stale';
  }

  // Resolve product info (fall back to nickname or id if name unavailable).
  let productName: string | null = null;
  let productId: string | null = null;
  if (typeof price.product === 'string') {
    productId = price.product;
  } else if (price.product) {
    productId = price.product.id;
    if ('name' in price.product && typeof price.product.name === 'string') {
      productName = price.product.name;
    }
  }
  if (!productName) productName = price.nickname || price.id;

  const period = getPeriodDates(sub);

  const row = {
    org_id: resolved.orgId,
    client_id: resolved.clientId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_price_id: price.id,
    stripe_product_id: productId,
    product_name: productName,
    amount_cents: price.unit_amount, // nullable now (tiered/usage pricing)
    currency: price.currency || 'usd',
    interval: price.recurring.interval,
    interval_count: price.recurring.interval_count || 1,
    status: sub.status,
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    canceled_at: toIsoOrNull(sub.canceled_at),
    ended_at: toIsoOrNull(sub.ended_at),
    trial_end: toIsoOrNull(sub.trial_end),
    metadata: (sub.metadata as Record<string, string>) || {},
    last_synced_at: new Date().toISOString(),
    last_event_at: eventCreatedISO,
  };

  const { error } = await supabase
    .from('client_subscriptions')
    .upsert(row, { onConflict: 'stripe_subscription_id' });

  if (error) {
    console.error('[subscription-sync] Upsert failed', {
      subscriptionId: sub.id,
      error: error.message,
    });
    throw error;
  }

  console.log('[subscription-sync] Synced', {
    subscriptionId: sub.id,
    clientId: resolved.clientId,
    status: sub.status,
    periodEnd: period.end,
  });
  return 'synced';
}

/**
 * Handle customer.subscription.deleted.
 *
 * If we don't have a local row yet (e.g. .deleted arrived before .created
 * could be processed), upsert a canceled row directly via the same sync
 * path so we don't lose the cancel signal.
 */
export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  opts: SyncOptions
): Promise<void> {
  const supabase = supabaseAdmin();

  // Stale-guard same as the regular sync path.
  const eventCreatedISO = new Date(opts.eventCreatedAt * 1000).toISOString();
  const { data: existing } = await supabase
    .from('client_subscriptions')
    .select('id, last_event_at')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();

  if (existing) {
    if (existing.last_event_at && existing.last_event_at >= eventCreatedISO) {
      console.log('[subscription-sync] Skipping stale delete event', { subscriptionId: sub.id });
      return;
    }
    const { error } = await supabase
      .from('client_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: toIsoOrNull(sub.canceled_at) || new Date().toISOString(),
        ended_at: toIsoOrNull(sub.ended_at) || new Date().toISOString(),
        cancel_at_period_end: false,
        last_synced_at: new Date().toISOString(),
        last_event_at: eventCreatedISO,
      })
      .eq('id', existing.id);
    if (error) {
      console.error('[subscription-sync] Failed to mark canceled', {
        subscriptionId: sub.id,
        error: error.message,
      });
      throw error;
    }
    console.log('[subscription-sync] Marked canceled', { subscriptionId: sub.id });
    return;
  }

  // Row doesn't exist yet — sync it (Stripe still gives us full state on delete events).
  const result = await syncSubscriptionFromStripe(sub, opts);
  console.log('[subscription-sync] Delete-before-create fallback', {
    subscriptionId: sub.id,
    result,
  });
}
