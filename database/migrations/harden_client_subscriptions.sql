-- QC follow-up to create_client_subscriptions_table.sql
--
-- Addresses:
--   * Out-of-order webhook delivery resurrecting canceled subscriptions
--   * Revenue audit safety (don't cascade-delete subscription history)
--   * Tiered/usage pricing where unit_amount is null
--   * Log spam from subscriptions that don't belong to us

-- 1. Track the latest event timestamp seen per subscription so the sync
--    upsert can refuse stale updates.
ALTER TABLE client_subscriptions
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

-- 2. Allow null amount_cents for tiered/usage pricing (Stripe returns
--    unit_amount = null in those cases).
ALTER TABLE client_subscriptions
  ALTER COLUMN amount_cents DROP NOT NULL;

-- 3. Revenue audit: don't lose subscription history when a client is deleted.
--    RESTRICT means a client with subscriptions can't be deleted until
--    subscriptions are canceled/archived first.
ALTER TABLE client_subscriptions
  DROP CONSTRAINT IF EXISTS fk_client_subscriptions_client;
ALTER TABLE client_subscriptions
  ADD CONSTRAINT fk_client_subscriptions_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

-- 4. Dead-letter table for subscriptions we can't resolve to a local client.
--    Lets us short-circuit warn-log spam from other systems sharing the
--    same Stripe account (or test-mode subs).
CREATE TABLE IF NOT EXISTS stripe_unknown_subscriptions (
  stripe_subscription_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_count INTEGER NOT NULL DEFAULT 1,
  metadata_keys TEXT[]
);

ALTER TABLE stripe_unknown_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages unknown subs" ON stripe_unknown_subscriptions;
CREATE POLICY "Service role manages unknown subs"
  ON stripe_unknown_subscriptions FOR ALL
  USING (auth.role() = 'service_role');
