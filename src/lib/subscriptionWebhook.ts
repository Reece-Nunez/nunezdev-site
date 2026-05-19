/**
 * Webhook handlers for the auto-draft subscription flow. Split out from the
 * giant /api/stripe/webhook/route.ts so the email + linking logic is in one
 * place.
 *
 * Three events matter here:
 *   - customer.subscription.created with metadata.recurring_invoice_id
 *       → link sub to recurring_invoice + send enrollment confirmation
 *   - invoice.paid (subscription-mode invoice)
 *       → send branded receipt
 *   - invoice.payment_failed (subscription-mode invoice)
 *       → send branded payment-declined notice
 *
 * All emails go through the subscription_email_log idempotency check so
 * duplicate webhook deliveries can't double-send.
 */
import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  sendEnrollmentConfirmation,
  sendSubscriptionReceipt,
  sendSubscriptionPaymentFailed,
  sendSubscriptionCanceled,
} from '@/lib/subscriptionEmail';

// The Stripe SDK type defs for API 2025-07-30.basil have stopped exposing
// some legacy fields that are still present at runtime. We narrow via an
// intersection type so we can read them without `any` casts everywhere.
type InvoiceWithLegacyFields = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
};
type InvoiceLineWithLegacyFields = Stripe.InvoiceLineItem & {
  plan?: Stripe.Plan | null;
};

interface ClientLookup {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
}

async function lookupClientByCustomer(customerId: string): Promise<ClientLookup | null> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('clients')
    .select('id, org_id, name, email')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data || null;
}

/**
 * Pull card last4 / brand from a payment intent so the receipt email can
 * say "VISA ending in 4242." Returns nulls if not available — emails
 * gracefully fall back to "card on file."
 */
async function getCardDetailsFromInvoice(
  invoice: Stripe.Invoice,
  stripe: Stripe
): Promise<{ brand: string | null; last4: string | null }> {
  const pi = (invoice as InvoiceWithLegacyFields).payment_intent;
  if (!pi) return { brand: null, last4: null };
  const piId = typeof pi === 'string' ? pi : pi.id;
  try {
    const intent = await stripe.paymentIntents.retrieve(piId, {
      expand: ['latest_charge.payment_method_details'],
    });
    const charge =
      intent.latest_charge && typeof intent.latest_charge !== 'string'
        ? intent.latest_charge
        : null;
    const card = charge?.payment_method_details?.card;
    return { brand: card?.brand ?? null, last4: card?.last4 ?? null };
  } catch (err) {
    console.warn('[subscription-webhook] Could not fetch card details', err);
    return { brand: null, last4: null };
  }
}

/**
 * Generate a Stripe Customer Portal URL the client can use to update
 * their card. Returns null if generation fails — emails just omit the
 * "Update payment method" button in that case.
 */
async function makePortalUrl(stripeCustomerId: string, stripe: Stripe): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: baseUrl,
    });
    return session.url;
  } catch (err) {
    console.warn('[subscription-webhook] Could not generate portal URL', err);
    return null;
  }
}

/**
 * When a subscription is created via the autodraft enrollment flow,
 * link it back to the recurring_invoice and send the enrollment email.
 * No-op if the subscription wasn't created via that flow.
 */
export async function maybeHandleEnrollment(
  sub: Stripe.Subscription,
  stripeEventId: string
): Promise<void> {
  const md = (sub.metadata || {}) as Record<string, string>;
  const recurringInvoiceId = md.recurring_invoice_id;
  if (!recurringInvoiceId || md.source !== 'autodraft_enrollment') return;

  const supabase = supabaseAdmin();

  // Find the recurring_invoice and verify it doesn't already have a
  // subscription linked (would mean we already processed this).
  const { data: recurring } = await supabase
    .from('recurring_invoices')
    .select('id, org_id, client_id, title, stripe_subscription_id')
    .eq('id', recurringInvoiceId)
    .maybeSingle();

  if (!recurring) {
    console.warn('[subscription-webhook] recurring_invoice not found for enrollment', {
      recurringInvoiceId,
      subscriptionId: sub.id,
    });
    return;
  }

  // Backfill the link — safe to run multiple times because we filter on
  // stripe_subscription_id IS NULL to avoid overwriting a different sub
  // that may have been linked by a race.
  if (!recurring.stripe_subscription_id) {
    await supabase
      .from('recurring_invoices')
      .update({
        stripe_subscription_id: sub.id,
        migrated_to_subscription_at: new Date().toISOString(),
      })
      .eq('id', recurring.id)
      .is('stripe_subscription_id', null);
  }

  // Send enrollment confirmation. The send helper itself dedupes via
  // subscription_email_log so a webhook retry won't double-send.
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return;
  const client = await lookupClientByCustomer(customerId);
  if (!client?.email) return;

  const item = sub.items.data[0];
  const price = item?.price;
  if (!price?.recurring) return;

  const productName =
    typeof price.product !== 'string' && price.product && 'name' in price.product
      ? (price.product as Stripe.Product).name
      : recurring.title || 'NunezDev recurring service';

  // current_period_end lives on the subscription item in API 2025-07-30.basil
  const periodEnd = (item as Stripe.SubscriptionItem & { current_period_end?: number })
    .current_period_end;

  await sendEnrollmentConfirmation({
    to: client.email,
    clientName: client.name,
    productName,
    amountCents: price.unit_amount ?? 0,
    currency: price.currency || 'usd',
    interval: price.recurring.interval,
    intervalCount: price.recurring.interval_count || 1,
    nextChargeAt: periodEnd ?? null,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    orgId: client.org_id,
    clientId: client.id,
    stripeEventId,
  });
}

/**
 * Send branded receipt for a successful subscription auto-charge.
 * Only acts on invoices with a subscription id — skips one-off invoices.
 */
export async function handleSubscriptionInvoicePaid(
  invoice: Stripe.Invoice,
  stripe: Stripe,
  stripeEventId: string
): Promise<void> {
  const inv = invoice as InvoiceWithLegacyFields;
  if (!inv.subscription) return; // one-off invoice, leave to existing handler

  const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
  if (!customerId) return;
  const client = await lookupClientByCustomer(customerId);
  if (!client?.email) return;

  const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription.id;

  // Snapshot product name from the first line item; fall back gracefully.
  const firstLine = inv.lines.data[0] as InvoiceLineWithLegacyFields | undefined;
  const productName =
    firstLine?.description ||
    firstLine?.plan?.nickname ||
    'NunezDev recurring service';

  const { brand, last4 } = await getCardDetailsFromInvoice(inv, stripe);

  const paidAt = inv.status_transitions?.paid_at ?? Math.floor(Date.now() / 1000);

  await sendSubscriptionReceipt({
    to: client.email,
    clientName: client.name,
    productName,
    amountPaidCents: inv.amount_paid ?? inv.total ?? 0,
    currency: inv.currency || 'usd',
    paidAt,
    invoicePdfUrl: inv.invoice_pdf || null,
    hostedInvoiceUrl: inv.hosted_invoice_url || null,
    cardBrand: brand,
    cardLast4: last4,
    stripeInvoiceId: inv.id ?? '',
    stripeSubscriptionId: subId,
    orgId: client.org_id,
    clientId: client.id,
    stripeEventId,
  });
}

export async function handleSubscriptionInvoiceFailed(
  invoice: Stripe.Invoice,
  stripe: Stripe,
  stripeEventId: string
): Promise<void> {
  const inv = invoice as InvoiceWithLegacyFields;
  if (!inv.subscription) return;

  const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
  if (!customerId) return;
  const client = await lookupClientByCustomer(customerId);
  if (!client?.email) return;

  const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription.id;

  const firstLine = inv.lines.data[0] as InvoiceLineWithLegacyFields | undefined;
  const productName =
    firstLine?.description ||
    firstLine?.plan?.nickname ||
    'NunezDev recurring service';

  const { brand, last4 } = await getCardDetailsFromInvoice(inv, stripe);
  const portalUrl = await makePortalUrl(customerId, stripe);

  await sendSubscriptionPaymentFailed({
    to: client.email,
    clientName: client.name,
    productName,
    amountCents: inv.amount_due ?? inv.total ?? 0,
    currency: inv.currency || 'usd',
    attemptCount: inv.attempt_count ?? 1,
    nextAttemptAt: inv.next_payment_attempt ?? null,
    cardBrand: brand,
    cardLast4: last4,
    updatePaymentUrl: portalUrl,
    stripeInvoiceId: inv.id ?? '',
    stripeSubscriptionId: subId,
    orgId: client.org_id,
    clientId: client.id,
    stripeEventId,
  });
}

/**
 * Send branded "subscription canceled" email when a subscription ends.
 * Distinguishes cancel-from-failed-payment vs admin/client-requested cancel.
 */
export async function maybeSendCancellationEmail(
  sub: Stripe.Subscription,
  stripeEventId: string
): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return;
  const client = await lookupClientByCustomer(customerId);
  if (!client?.email) return;

  // Determine cancellation reason. Stripe sets `cancellation_details.reason`
  // on newer API versions; fall back to inferring from status.
  const details = (sub as Stripe.Subscription & {
    cancellation_details?: { reason?: string };
  }).cancellation_details;
  let reason: 'unpaid' | 'requested' | 'other' = 'other';
  if (details?.reason === 'payment_failed') reason = 'unpaid';
  else if (details?.reason === 'cancellation_requested') reason = 'requested';
  else if (sub.status === 'unpaid' || sub.status === 'canceled') {
    // If we don't have explicit details, infer: missing details + canceled status
    // most commonly indicates an admin-side or user-requested cancellation.
    reason = 'requested';
  }

  const item = sub.items.data[0];
  const price = item?.price;
  const productName =
    price && typeof price.product !== 'string' && price.product && 'name' in price.product
      ? (price.product as Stripe.Product).name
      : 'NunezDev recurring service';

  await sendSubscriptionCanceled({
    to: client.email,
    clientName: client.name,
    productName,
    reason,
    stripeSubscriptionId: sub.id,
    orgId: client.org_id,
    clientId: client.id,
    stripeEventId,
  });
}
