-- Overdue-invoice SMS dunning ladder (Phase 2 of the SMS follow-up work).
--
-- 1. A dedicated dedupe ledger so each dunning tier fires at most once per
--    invoice, ever. We use a NEW table (not invoice_followups) so the SMS ladder
--    and the email ladder can't cross-contaminate each other's dedupe — they run
--    on different day thresholds (SMS 3/10/21, email 1/7/14/30) and share nothing.
-- 2. A fix for a latent bug: smsReminders.ts writes activity_type
--    'invoice_sms_sent' / 'invoice_sms_skipped' to client_activity_log, but the
--    table's CHECK constraint never allowed those values, so every such insert
--    silently failed (0 rows in prod as of 2026-07-07). That broke the
--    chokepoint's audit trail AND its per-day dedupe (which reads those rows).
--    We widen the constraint to permit them.
--
-- Applied to the NunezDev Supabase project on 2026-07-07.

-- 1. Dunning SMS dedupe ledger ------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_dunning_sms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  -- Ladder rung. 'shutdown' is reserved for Phase 3 (owner-approved) and is
  -- allowed here now so the approval flow can reuse this ledger without another
  -- migration.
  tier         text NOT NULL CHECK (tier IN ('gentle', 'firm', 'urgent', 'shutdown')),
  days_overdue integer NOT NULL,
  twilio_sid   text,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- One row per (invoice, tier): the atomic "already sent this rung" guard.
  UNIQUE (invoice_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_invoice_dunning_sms_invoice_id ON invoice_dunning_sms(invoice_id);

ALTER TABLE invoice_dunning_sms ENABLE ROW LEVEL SECURITY;
-- Only the cron (service role) touches this; no client/anon access.
DROP POLICY IF EXISTS "Service role can manage invoice_dunning_sms" ON invoice_dunning_sms;
CREATE POLICY "Service role can manage invoice_dunning_sms" ON invoice_dunning_sms
  FOR ALL USING (auth.role() = 'service_role');

-- 2. Let the invoice-SMS audit rows actually insert ---------------------------
ALTER TABLE client_activity_log DROP CONSTRAINT client_activity_log_activity_type_check;
ALTER TABLE client_activity_log ADD CONSTRAINT client_activity_log_activity_type_check
  CHECK (activity_type = ANY (ARRAY[
    'invoice_viewed'::text,
    'invoice_downloaded'::text,
    'contract_signed'::text,
    'payment_initiated'::text,
    'payment_completed'::text,
    'payment_failed'::text,
    'payment_link_clicked'::text,
    'email_opened'::text,
    'email_sent'::text,
    'recurring_invoice_sent'::text,
    'proposal_converted'::text,
    'invoice_sms_sent'::text,
    'invoice_sms_skipped'::text
  ]));
