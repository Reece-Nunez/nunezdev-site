-- QC follow-up to create_client_subscription_schedules_table.sql
--
-- Addresses:
--   * Log spam for schedules that don't belong to us (add dead-letter)
--   * Phase 2 UI will join client_subscriptions → schedules via subscription id

-- Dead-letter for schedules we can't resolve (mirror of stripe_unknown_subscriptions)
CREATE TABLE IF NOT EXISTS stripe_unknown_schedules (
  stripe_schedule_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_count INTEGER NOT NULL DEFAULT 1,
  metadata_keys TEXT[]
);

ALTER TABLE stripe_unknown_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages unknown schedules" ON stripe_unknown_schedules;
CREATE POLICY "Service role manages unknown schedules"
  ON stripe_unknown_schedules FOR ALL
  USING (auth.role() = 'service_role');

-- Speeds up Phase 2 UI queries that join client_subscriptions → schedules
-- via the released subscription id. Partial because most schedule rows
-- never have a subscription id (not_started or canceled before release).
CREATE INDEX IF NOT EXISTS idx_subscription_schedules_stripe_subscription
  ON client_subscription_schedules(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
