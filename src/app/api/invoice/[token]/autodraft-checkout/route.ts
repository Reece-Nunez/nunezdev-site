/**
 * PUBLIC endpoint — auth is the invoice access_token, NOT a user session.
 *
 * The client clicks "Set up Auto-Pay" in their invoice email. This creates a
 * Stripe Subscription Checkout session matching the recurring schedule the
 * invoice came from. After they enter their card:
 *   1. Stripe charges the first cycle immediately (covers the current invoice)
 *   2. Future cycles auto-charge on the same day of the month
 *   3. Webhook fires customer.subscription.created with metadata.recurring_invoice_id
 *   4. We link the subscription back to the recurring_invoice and stop the cron
 *
 * Two methods:
 *   - GET  → 302 redirects to Stripe Checkout (one-click from email)
 *   - POST → returns { url } as JSON (for in-page JS to handle navigation)
 *
 * Idempotency keys on both Stripe customer creation and Checkout session
 * creation mean repeated requests are safe (no duplicate customers or
 * duplicate Checkout sessions).
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ token: string }>;
}

type Result =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

function frequencyToInterval(
  frequency: string
): { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number } | null {
  switch (frequency) {
    case 'weekly':
      return { interval: 'week', interval_count: 1 };
    case 'monthly':
      return { interval: 'month', interval_count: 1 };
    case 'quarterly':
      return { interval: 'month', interval_count: 3 };
    case 'annually':
      return { interval: 'year', interval_count: 1 };
    default:
      return null;
  }
}

async function createAutodraftCheckoutUrl(token: string): Promise<Result> {
  if (!token || token.length < 16) {
    return { ok: false, status: 400, error: 'Invalid invoice link' };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, status: 500, error: 'Stripe not configured' };
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = supabaseAdmin();

  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      `id, recurring_invoice_id, org_id, client_id, invoice_number,
       clients!inner(id, name, email, stripe_customer_id, org_id)`
    )
    .eq('access_token', token)
    .single();

  if (!invoice) return { ok: false, status: 404, error: 'Invoice not found' };
  if (!invoice.recurring_invoice_id) {
    return {
      ok: false,
      status: 400,
      error: "This invoice isn't part of a recurring schedule, so auto-pay isn't available.",
    };
  }

  const client = (invoice.clients as unknown) as {
    id: string;
    name: string;
    email: string | null;
    stripe_customer_id: string | null;
    org_id: string;
  };

  if (!client.email) {
    return {
      ok: false,
      status: 400,
      error: 'No email on file for this client. Please contact NunezDev before enrolling.',
    };
  }

  const { data: recurring } = await supabase
    .from('recurring_invoices')
    .select(
      'id, org_id, client_id, title, description, amount_cents, frequency, day_of_month, status, stripe_subscription_id'
    )
    .eq('id', invoice.recurring_invoice_id)
    .single();

  if (!recurring) {
    return { ok: false, status: 404, error: 'Recurring schedule not found' };
  }
  if (recurring.stripe_subscription_id) {
    return {
      ok: false,
      status: 409,
      error:
        'This schedule is already on auto-pay. Future charges will happen automatically — nothing more to do.',
    };
  }
  if (recurring.status !== 'active') {
    return { ok: false, status: 400, error: "This recurring schedule isn't active." };
  }

  const interval = frequencyToInterval(recurring.frequency);
  if (!interval) {
    return {
      ok: false,
      status: 400,
      error: `Unsupported recurring frequency: ${recurring.frequency}`,
    };
  }

  // Ensure Stripe customer exists. Idempotency key keyed by client.id so a
  // rapid double-click returns the same customer.
  let stripeCustomerId = client.stripe_customer_id;
  if (!stripeCustomerId) {
    try {
      const customer = await stripe.customers.create(
        {
          name: client.name,
          email: client.email,
          metadata: {
            client_id: client.id,
            org_id: client.org_id,
            source: 'autodraft_enrollment',
          },
        },
        { idempotencyKey: `client-customer-${client.id}` }
      );
      stripeCustomerId = customer.id;
      await supabase
        .from('clients')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', client.id);
    } catch (err) {
      console.error('[autodraft-checkout] customer.create failed', err);
      return {
        ok: false,
        status: 500,
        error: 'Could not prepare your account for auto-pay. Please try again.',
      };
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
  const dayBucket = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `autodraft-${recurring.id}-${dayBucket}`;

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: stripeCustomerId,
        payment_method_types: ['card'], // skip Link SMS prompt
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: recurring.amount_cents,
              recurring: interval,
              product_data: {
                name: recurring.title || 'NunezDev Retainer',
                ...(recurring.description ? { description: recurring.description } : {}),
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          recurring_invoice_id: recurring.id,
          client_id: client.id,
          org_id: client.org_id,
          current_invoice_id: invoice.id,
          source: 'autodraft_enrollment',
        },
        subscription_data: {
          metadata: {
            recurring_invoice_id: recurring.id,
            client_id: client.id,
            org_id: client.org_id,
            source: 'autodraft_enrollment',
          },
          description: recurring.title || 'NunezDev recurring services',
        },
        success_url: `${baseUrl}/invoice/${token}?autopay=success`,
        cancel_url: `${baseUrl}/invoice/${token}?autopay=canceled`,
      },
      { idempotencyKey }
    );
    if (!session.url) {
      return { ok: false, status: 500, error: 'Stripe did not return a Checkout URL.' };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    console.error('[autodraft-checkout] session.create failed', err);
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Stripe rejected the request.',
    };
  }
}

/**
 * One-click email flow: GET → create session → 302 to Stripe Checkout.
 * GET is normally idempotent; here it is too, thanks to Stripe idempotency
 * keys. A double-click returns the same session URL.
 */
export async function GET(_req: Request, context: RouteContext) {
  const { token } = await context.params;
  const result = await createAutodraftCheckoutUrl(token);
  if (!result.ok) {
    // Render a minimal HTML error page (this is a public link clicked from
    // email — JSON would be ugly to the end user).
    const escaped = result.error.replace(/[&<>]/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'
    );
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
    return new NextResponse(
      `<!doctype html><html><head><meta charset="utf-8"><title>Auto-Pay</title>
       <style>body{font-family:-apple-system,sans-serif;max-width:480px;margin:48px auto;padding:24px;color:#222;line-height:1.5}
       h1{font-size:20px;margin-bottom:12px}a{color:#5b7c99}</style></head>
       <body><h1>We couldn't set up auto-pay</h1>
       <p>${escaped}</p>
       <p><a href="${baseUrl}/invoice/${token}">← Back to invoice</a></p>
       </body></html>`,
      { status: result.status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
  return NextResponse.redirect(result.url, { status: 302 });
}

/** JSON variant for in-app use (e.g., a button on the invoice page). */
export async function POST(_req: Request, context: RouteContext) {
  const { token } = await context.params;
  const result = await createAutodraftCheckoutUrl(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}
