-- Phase 1: Mirror Stripe Subscriptions into our DB so the CRM has a single
-- source of truth for recurring revenue.
--
-- Stripe remains the system of record for billing (charges, retries, dunning).
-- This table is a read-mostly mirror updated by the Stripe webhook on
-- customer.subscription.* events.

CREATE TABLE IF NOT EXISTS client_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  client_id UUID NOT NULL,

  -- Stripe identifiers
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  stripe_price_id TEXT,
  stripe_product_id TEXT,

  -- Denormalized display fields (snapshotted from Stripe on each sync)
  product_name TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  interval TEXT NOT NULL CHECK (interval IN ('day', 'week', 'month', 'year')),
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count > 0),

  -- Lifecycle state (mirrors Stripe Subscription.status)
  status TEXT NOT NULL CHECK (status IN (
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
  )),

  -- Billing window snapshot
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Catch-all for fields we don't model explicitly yet
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Sync bookkeeping (so we can audit drift / detect stale rows)
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client_id
  ON client_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_org_status
  ON client_subscriptions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_stripe_customer
  ON client_subscriptions(stripe_customer_id);

-- Foreign keys (added after table creation so the migration is safe to re-run
-- against partially-existing schemas).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_client_subscriptions_client'
  ) THEN
    ALTER TABLE client_subscriptions
      ADD CONSTRAINT fk_client_subscriptions_client
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_client_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_subscriptions_updated_at ON client_subscriptions;
CREATE TRIGGER trg_client_subscriptions_updated_at
  BEFORE UPDATE ON client_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_client_subscriptions_updated_at();

-- RLS: org-scoped read for authed members, service role full access
ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage client_subscriptions" ON client_subscriptions;
CREATE POLICY "Service role can manage client_subscriptions"
  ON client_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Org members can read their subscriptions" ON client_subscriptions;
CREATE POLICY "Org members can read their subscriptions"
  ON client_subscriptions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );
