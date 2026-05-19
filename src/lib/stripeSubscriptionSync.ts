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
  /**
   * Optional Stripe client. When provided, the schedule sync will fetch
   * unexpanded price data (Stripe returns price as a string id by default
   * on schedule payloads, so product_name / amount / interval would be null
   * without this).
   */
  stripe?: import('stripe').default;
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

  // Strict greater-than: events with the exact same timestamp are allowed
  // through (Stripe's event.created has 1-second resolution and two events
  // can legitimately be created in the same second).
  if (existing?.last_event_at && existing.last_event_at > eventCreatedISO) {
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

// ---------------------------------------------------------------------------
// Subscription Schedules (Phase 1.5 / Path B)
//
// A schedule is Stripe's way of saying "create a subscription on date X
// with these phases." When the start date arrives Stripe creates the actual
// Subscription and fires customer.subscription.created — handled above.
//
// We mirror the schedule itself so the CRM can show "Blake — Pending $500/mo
// starting Dec 1" before the first invoice fires.
// ---------------------------------------------------------------------------

async function resolveClientForSchedule(
  schedule: Stripe.SubscriptionSchedule
): Promise<{ orgId: string; clientId: string } | null> {
  const supabase = supabaseAdmin();

  const customerId = typeof schedule.customer === 'string'
    ? schedule.customer
    : schedule.customer?.id;

  if (customerId) {
    const { data } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data) return { orgId: data.org_id, clientId: data.id };
  }

  const md = (schedule.metadata || {}) as Record<string, string>;
  if (md.client_id) {
    const { data } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', md.client_id)
      .maybeSingle();
    if (data) return { orgId: data.org_id, clientId: data.id };
  }

  return null;
}

/**
 * Mirror of recordUnknownSubscription for schedules. Upserts into the
 * dead-letter table and warn-logs only on first encounter to avoid
 * flooding logs on Stripe's webhook retries.
 */
async function recordUnknownSchedule(schedule: Stripe.SubscriptionSchedule): Promise<void> {
  const supabase = supabaseAdmin();
  const customerId = typeof schedule.customer === 'string'
    ? schedule.customer
    : schedule.customer?.id ?? null;
  const metadataKeys = Object.keys(schedule.metadata || {});

  const { data: existing } = await supabase
    .from('stripe_unknown_schedules')
    .select('seen_count')
    .eq('stripe_schedule_id', schedule.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('stripe_unknown_schedules')
      .update({
        last_seen_at: new Date().toISOString(),
        seen_count: (existing.seen_count || 0) + 1,
        stripe_customer_id: customerId,
        metadata_keys: metadataKeys,
      })
      .eq('stripe_schedule_id', schedule.id);
  } else {
    await supabase.from('stripe_unknown_schedules').insert({
      stripe_schedule_id: schedule.id,
      stripe_customer_id: customerId,
      metadata_keys: metadataKeys,
    });
    console.warn('[schedule-sync] Unknown schedule (no matching client)', {
      scheduleId: schedule.id,
      customerId,
      metadataKeys,
    });
  }
}

/**
 * Strip user-controlled metadata from phases before persisting to keep
 * the JSONB column free of PII and bounded in size.
 */
function projectPhasesForStorage(
  phases: Stripe.SubscriptionSchedule.Phase[]
): Record<string, unknown>[] {
  return phases.map((phase) => ({
    start_date: phase.start_date,
    end_date: phase.end_date,
    proration_behavior: phase.proration_behavior,
    items: (phase.items || []).map((item) => ({
      price: typeof item.price === 'string' ? item.price : item.price?.id,
      quantity: item.quantity,
    })),
    // intentionally NOT including: metadata, billing_thresholds, transfer_data,
    // application_fee_percent, default_tax_rates, etc. Add explicitly if needed.
  }));
}

/**
 * Snapshot the current (or first upcoming) phase's primary item for display.
 * Matches the current phase by BOTH start_date and end_date because Stripe
 * allows zero-duration phases where start_date alone isn't unique.
 */
function snapshotPhaseItem(schedule: Stripe.SubscriptionSchedule): {
  priceId: string | null;
  productId: string | null;
  productName: string | null;
  amountCents: number | null;
  currency: string;
  interval: Stripe.Price.Recurring.Interval | null;
  intervalCount: number | null;
} {
  const empty = {
    priceId: null,
    productId: null,
    productName: null,
    amountCents: null,
    currency: 'usd',
    interval: null,
    intervalCount: null,
  };

  // Prefer the current phase (matched by BOTH start and end date — zero-duration
  // phases share start dates), else the first phase.
  const cp = schedule.current_phase;
  const currentPhase = cp
    ? schedule.phases.find(
        (p) => p.start_date === cp.start_date && p.end_date === cp.end_date,
      )
    : null;
  const phase = currentPhase || schedule.phases[0];
  const item = phase?.items?.[0];
  if (!item) return empty;

  // The price field on a SubscriptionScheduleConfiguration.Phase.Item can be:
  //   - a string id (unexpanded)
  //   - a full Stripe.Price (live)
  //   - a Stripe.DeletedPrice (only has id + deleted:true)
  const rawPrice = item.price;
  const priceId = typeof rawPrice === 'string' ? rawPrice : rawPrice?.id ?? null;

  // Narrow to non-deleted Price (DeletedPrice has `.deleted === true`)
  const livePrice =
    rawPrice && typeof rawPrice !== 'string' && !('deleted' in rawPrice && rawPrice.deleted)
      ? (rawPrice as Stripe.Price)
      : null;

  let productId: string | null = null;
  let productName: string | null = null;
  if (livePrice) {
    if (typeof livePrice.product === 'string') {
      productId = livePrice.product;
    } else if (livePrice.product) {
      productId = livePrice.product.id;
      if ('name' in livePrice.product && typeof livePrice.product.name === 'string') {
        productName = livePrice.product.name;
      }
    }
    if (!productName) productName = livePrice.nickname || livePrice.id;
  }

  return {
    priceId,
    productId,
    productName,
    amountCents: livePrice?.unit_amount ?? null,
    currency: livePrice?.currency || 'usd',
    interval: livePrice?.recurring?.interval ?? null,
    intervalCount: livePrice?.recurring?.interval_count ?? null,
  };
}

/**
 * Upsert a Stripe Subscription Schedule into our mirror.
 * Same idempotency + out-of-order guarantees as syncSubscriptionFromStripe.
 */
export async function syncSubscriptionScheduleFromStripe(
  schedule: Stripe.SubscriptionSchedule,
  opts: SyncOptions
): Promise<'synced' | 'skipped' | 'stale'> {
  const supabase = supabaseAdmin();

  const resolved = await resolveClientForSchedule(schedule);
  if (!resolved) {
    await recordUnknownSchedule(schedule);
    return 'skipped';
  }

  const eventCreatedISO = new Date(opts.eventCreatedAt * 1000).toISOString();
  const { data: existing } = await supabase
    .from('client_subscription_schedules')
    .select('last_event_at')
    .eq('stripe_schedule_id', schedule.id)
    .maybeSingle();

  // Strict greater-than: same-second events are allowed (Stripe event.created has 1s resolution).
  if (existing?.last_event_at && existing.last_event_at > eventCreatedISO) {
    console.log('[schedule-sync] Skipping stale event', { scheduleId: schedule.id });
    return 'stale';
  }

  let snapshot = snapshotPhaseItem(schedule);

  // Stripe returns schedule.phases[].items[].price as a string id by default.
  // If we have a stripe client, fetch the price (with product) to fill in
  // the display fields (product_name, amount_cents, interval).
  if (snapshot.priceId && snapshot.amountCents === null && opts.stripe) {
    try {
      const price = await opts.stripe.prices.retrieve(snapshot.priceId, {
        expand: ['product'],
      });
      let prodId: string | null = null;
      let prodName: string | null = null;
      if (typeof price.product === 'string') {
        prodId = price.product;
      } else if (price.product) {
        prodId = price.product.id;
        if ('name' in price.product && typeof price.product.name === 'string') {
          prodName = price.product.name;
        }
      }
      if (!prodName) prodName = price.nickname || price.id;
      snapshot = {
        priceId: price.id,
        productId: prodId,
        productName: prodName,
        amountCents: price.unit_amount ?? null,
        currency: price.currency || 'usd',
        interval: price.recurring?.interval ?? null,
        intervalCount: price.recurring?.interval_count ?? null,
      };
    } catch (err) {
      console.warn('[schedule-sync] Failed to fetch price for display', {
        priceId: snapshot.priceId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Start / end dates across the whole schedule
  const firstPhase = schedule.phases[0];
  const lastPhase = schedule.phases[schedule.phases.length - 1];
  const startsAt = firstPhase?.start_date
    ? new Date(firstPhase.start_date * 1000).toISOString()
    : null;
  const endsAt = lastPhase?.end_date
    ? new Date(lastPhase.end_date * 1000).toISOString()
    : null;

  const row = {
    org_id: resolved.orgId,
    client_id: resolved.clientId,
    stripe_schedule_id: schedule.id,
    stripe_customer_id: typeof schedule.customer === 'string'
      ? schedule.customer
      : schedule.customer.id,
    stripe_subscription_id: typeof schedule.subscription === 'string'
      ? schedule.subscription
      : schedule.subscription?.id ?? null,
    stripe_price_id: snapshot.priceId,
    stripe_product_id: snapshot.productId,
    product_name: snapshot.productName,
    amount_cents: snapshot.amountCents,
    currency: snapshot.currency,
    interval: snapshot.interval,
    interval_count: snapshot.intervalCount,
    status: schedule.status,
    starts_at: startsAt,
    ends_at: endsAt,
    released_at: toIsoOrNull(schedule.released_at),
    canceled_at: toIsoOrNull(schedule.canceled_at),
    completed_at: toIsoOrNull(schedule.completed_at),
    end_behavior: schedule.end_behavior ?? null,
    phases: projectPhasesForStorage(schedule.phases),
    metadata: (schedule.metadata as Record<string, string>) || {},
    last_synced_at: new Date().toISOString(),
    last_event_at: eventCreatedISO,
  };

  const { error } = await supabase
    .from('client_subscription_schedules')
    .upsert(row, { onConflict: 'stripe_schedule_id' });

  if (error) {
    console.error('[schedule-sync] Upsert failed', {
      scheduleId: schedule.id,
      error: error.message,
    });
    throw error;
  }

  console.log('[schedule-sync] Synced', {
    scheduleId: schedule.id,
    clientId: resolved.clientId,
    status: schedule.status,
    startsAt,
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
    if (existing.last_event_at && existing.last_event_at > eventCreatedISO) {
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
