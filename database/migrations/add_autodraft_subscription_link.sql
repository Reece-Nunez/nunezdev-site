-- Phase 5a: link recurring_invoices to the Stripe Subscription they've been
-- migrated into (when the client opts into auto-draft).
--
-- Once stripe_subscription_id is set, the recurring-invoices cron skips the
-- row — Stripe is now the source of truth for that schedule. The original
-- recurring_invoices row stays for audit; it doesn't get deleted.

ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS migrated_to_subscription_at TIMESTAMPTZ;

-- Partial index — most rows won't have a subscription_id; partial keeps the
-- index tiny.
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_stripe_subscription
  ON recurring_invoices(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Email idempotency log. Branded notification emails (enrollment confirm,
-- payment receipt, payment failed, etc.) are triggered by Stripe webhooks,
-- which can deliver the same event multiple times. We key on (event_key)
-- to send each notification exactly once.
CREATE TABLE IF NOT EXISTS subscription_email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Composite key that uniquely identifies this notification. Format depends
  -- on email_type:
  --   enrollment:<stripe_subscription_id>
  --   receipt:<stripe_invoice_id>
  --   payment_failed:<stripe_invoice_id>
  --   canceled:<stripe_subscription_id>
  --   card_expiring:<stripe_customer_id>:<YYYY-MM>
  event_key TEXT NOT NULL UNIQUE,
  email_type TEXT NOT NULL CHECK (email_type IN (
    'enrollment',
    'receipt',
    'payment_failed',
    'canceled',
    'card_expiring'
  )),
  to_email TEXT NOT NULL,
  org_id UUID,
  client_id UUID,
  stripe_event_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_message_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_subscription_email_log_client
  ON subscription_email_log(client_id);
CREATE INDEX IF NOT EXISTS idx_subscription_email_log_type_sent
  ON subscription_email_log(email_type, sent_at DESC);

ALTER TABLE subscription_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages subscription_email_log" ON subscription_email_log;
CREATE POLICY "Service role manages subscription_email_log"
  ON subscription_email_log FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Org members read their email log" ON subscription_email_log;
CREATE POLICY "Org members read their email log"
  ON subscription_email_log FOR SELECT
  USING (
    org_id IS NULL
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
