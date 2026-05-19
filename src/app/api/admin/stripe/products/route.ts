/**
 * List Stripe products that have active recurring prices, formatted for the
 * "New Subscription" picker in the CRM.
 *
 * Returns a flat list of prices (one product can have multiple — monthly,
 * yearly, etc.). Easier to scan and pick than a nested product → prices tree
 * given that we have a small catalog.
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireOwner } from '@/lib/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    // Pull active, recurring prices with product expanded.
    const prices: {
      priceId: string;
      productId: string;
      productName: string;
      amountCents: number | null;
      currency: string;
      interval: string;
      intervalCount: number;
      nickname: string | null;
    }[] = [];

    for await (const price of stripe.prices.list({
      active: true,
      type: 'recurring',
      limit: 100,
      expand: ['data.product'],
    })) {
      if (!price.recurring) continue;
      if (typeof price.product !== 'object') continue;
      if ('deleted' in price.product && price.product.deleted) continue;
      // Skip inactive products
      if (!price.product.active) continue;

      prices.push({
        priceId: price.id,
        productId: price.product.id,
        productName: price.product.name,
        amountCents: price.unit_amount,
        currency: price.currency,
        interval: price.recurring.interval,
        intervalCount: price.recurring.interval_count,
        nickname: price.nickname,
      });
    }

    // Sort: product name, then by interval (month before year), then by amount asc
    prices.sort((a, b) => {
      const nameCmp = a.productName.localeCompare(b.productName);
      if (nameCmp !== 0) return nameCmp;
      const intervalOrder = { day: 0, week: 1, month: 2, year: 3 };
      const aOrder = intervalOrder[a.interval as keyof typeof intervalOrder] ?? 99;
      const bOrder = intervalOrder[b.interval as keyof typeof intervalOrder] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.amountCents || 0) - (b.amountCents || 0);
    });

    return NextResponse.json(
      { prices },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[stripe-products] list failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load Stripe products' },
      { status: 500 }
    );
  }
}
