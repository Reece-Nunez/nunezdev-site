/**
 * Read endpoint for the Subscriptions panel on the client detail page.
 *
 * Returns:
 *   - active   : Subscription rows that are currently or recently billing
 *                (status in active/trialing/past_due/paused/unpaid/incomplete)
 *   - pending  : Subscription Schedules that haven't released yet
 *                (status in not_started/active — released/canceled/completed
 *                are filtered out so we don't double-count released schedules
 *                whose Subscription is already in `active`)
 *   - history  : Canceled / ended subscriptions, for audit
 */
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'paused',
  'unpaid',
  'incomplete',
];

const HISTORY_STATUSES = ['canceled', 'incomplete_expired'];

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id: clientId } = await context.params;
  const supabase = supabaseAdmin();

  // Verify the client belongs to this org
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, email, stripe_customer_id')
    .eq('id', clientId)
    .eq('org_id', guard.orgId)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const [activeRes, historyRes, pendingRes] = await Promise.all([
    supabase
      .from('client_subscriptions')
      .select(
        `id, stripe_subscription_id, stripe_customer_id, status, product_name,
         amount_cents, currency, interval, interval_count,
         current_period_start, current_period_end, cancel_at_period_end,
         canceled_at, trial_end, created_at`
      )
      .eq('client_id', clientId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_subscriptions')
      .select(
        `id, stripe_subscription_id, status, product_name, amount_cents,
         currency, interval, interval_count, canceled_at, ended_at, created_at`
      )
      .eq('client_id', clientId)
      .in('status', HISTORY_STATUSES)
      // nullsFirst:false so incomplete_expired rows (no canceled_at) sort to the end
      .order('canceled_at', { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from('client_subscription_schedules')
      .select(
        `id, stripe_schedule_id, status, product_name, amount_cents, currency,
         interval, interval_count, starts_at, ends_at, end_behavior, created_at`
      )
      .eq('client_id', clientId)
      .in('status', ['not_started', 'active'])
      .order('starts_at', { ascending: true }),
  ]);

  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      stripeCustomerId: client.stripe_customer_id,
    },
    active: activeRes.data || [],
    pending: pendingRes.data || [],
    history: historyRes.data || [],
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
