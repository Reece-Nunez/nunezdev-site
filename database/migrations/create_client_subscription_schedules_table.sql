-- Phase 1.5: Mirror Stripe Subscription Schedules into our DB.
--
-- A Subscription Schedule is a Stripe object that defines a future or
-- multi-phase recurring billing plan. When its start date arrives, Stripe
-- "releases" it into a real Subscription (mirrored separately in
-- client_subscriptions).
--
-- We keep schedules in their own table because:
--   - They have phase-based pricing, not the simple single-price model
--     of an active Subscription
--   - Their lifecycle (not_started → active → released/canceled/completed)
--     is genuinely different
--   - It keeps UI queries clean: "active retainers" vs "scheduled retainers"

CREATE TABLE IF NOT EXISTS client_subscription_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  client_id UUID NOT NULL,

  stripe_schedule_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  -- Populated after the schedule releases into a real subscription.
  stripe_subscription_id TEXT,

  -- Snapshot of the first phase's primary line item for display.
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  product_name TEXT,
  amount_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  interval TEXT CHECK (interval IS NULL OR interval IN ('day', 'week', 'month', 'year')),
  interval_count INTEGER,

  status TEXT NOT NULL CHECK (status IN (
    'not_started',
    'active',
    'completed',
    'released',
    'canceled'
  )),

  -- Lifecycle dates
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Full Stripe phases payload for reference (we may surface phase counts,
  -- per-phase amounts, etc. in the UI later).
  phases JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Out-of-order guard (same pattern as client_subscriptions)
  last_event_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_schedules_client_id
  ON client_subscription_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_subscription_schedules_org_status
  ON client_subscription_schedules(org_id, status);
CREATE INDEX IF NOT EXISTS idx_subscription_schedules_stripe_customer
  ON client_subscription_schedules(stripe_customer_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_subscription_schedules_client'
  ) THEN
    ALTER TABLE client_subscription_schedules
      ADD CONSTRAINT fk_subscription_schedules_client
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_subscription_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscription_schedules_updated_at ON client_subscription_schedules;
CREATE TRIGGER trg_subscription_schedules_updated_at
  BEFORE UPDATE ON client_subscription_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_subscription_schedules_updated_at();

ALTER TABLE client_subscription_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages subscription_schedules"
  ON client_subscription_schedules;
CREATE POLICY "Service role manages subscription_schedules"
  ON client_subscription_schedules FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Org members read their schedules"
  ON client_subscription_schedules;
CREATE POLICY "Org members read their schedules"
  ON client_subscription_schedules FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );
