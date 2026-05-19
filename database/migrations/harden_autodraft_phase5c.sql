-- Phase 5c hardening — QC audit findings:
--   1. Cron could double-bill if two runs race (TOCTOU read, no unique constraint)
--   2. Email replay was impossible after a Resend failure (orphan log rows)

-- 1. Atomic guard against duplicate cron-generated invoices for the same
--    recurring schedule + billing period. The cron's existing in-process
--    check is TOCTOU; this unique index enforces the invariant at the DB.
--
--    billing_period_date is the date the invoice was generated for (mirrors
--    the recurring_invoices.next_invoice_date at the time of generation).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS billing_period_date DATE;

-- Backfill from issued_at for existing recurring rows so the unique index
-- can be created safely. Non-recurring rows stay null.
UPDATE invoices
SET billing_period_date = (issued_at AT TIME ZONE 'UTC')::date
WHERE recurring_invoice_id IS NOT NULL
  AND billing_period_date IS NULL
  AND issued_at IS NOT NULL;

-- Partial unique index — only recurring invoices need the guard; one-off
-- invoices have no per-period semantics.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_recurring_invoice_per_period
  ON invoices(recurring_invoice_id, billing_period_date)
  WHERE recurring_invoice_id IS NOT NULL AND billing_period_date IS NOT NULL;

-- 2. Email replay: change subscription_email_log from "row exists = email
--    sent" to a status-driven model so Resend failures can be retried by
--    subsequent webhook deliveries.
ALTER TABLE subscription_email_log
  ADD COLUMN IF NOT EXISTS status TEXT;

-- Backfill: anything already in the table sent successfully (we used to
-- only insert AFTER send) — but in the new model we insert as pending FIRST,
-- so any existing rows from before this migration were definitely sent.
UPDATE subscription_email_log
SET status = 'sent'
WHERE status IS NULL;

ALTER TABLE subscription_email_log
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ADD CONSTRAINT subscription_email_log_status_check
    CHECK (status IN ('pending', 'sent', 'failed'));

CREATE INDEX IF NOT EXISTS idx_subscription_email_log_status
  ON subscription_email_log(status)
  WHERE status IN ('pending', 'failed');
