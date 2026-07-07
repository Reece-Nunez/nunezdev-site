-- Owner-approval queue for the harshest dunning rung (Phase 3 of the SMS
-- follow-up work). The 35-day "your site could be shut down" text is never
-- auto-sent: the cron drops a PENDING row here, the owner sees it in a dashboard
-- banner, and only an explicit Approve actually sends it. This mirrors the email
-- ladder's decision to keep 14/30-day notices human-reviewed.
--
-- Denormalized client_name / invoice_number / amount_cents let the banner render
-- without extra joins. body is the exact message that sends on approval, frozen
-- at creation time so what the owner approves is what goes out.
--
-- Applied to the NunezDev Supabase project on 2026-07-07.

CREATE TABLE IF NOT EXISTS pending_sms_approvals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  org_id         uuid NOT NULL,
  -- Which approval-gated rung. 'shutdown' today; leaves room for future gated tiers.
  tier           text NOT NULL DEFAULT 'shutdown' CHECK (tier IN ('shutdown')),
  body           text NOT NULL,
  days_overdue   integer NOT NULL,
  amount_cents   integer NOT NULL,
  client_name    text,
  invoice_number text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  twilio_sid     text,
  resolved_at    timestamptz,
  resolved_by    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- One approval per (invoice, tier), ever. ON CONFLICT DO NOTHING at creation
  -- makes the cron idempotent: a dismissed/approved row is never resurrected.
  UNIQUE (invoice_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_pending_sms_approvals_org_status
  ON pending_sms_approvals(org_id, status);

ALTER TABLE pending_sms_approvals ENABLE ROW LEVEL SECURITY;
-- Cron (service role) creates rows; the owner-guarded API routes use the service
-- role too and scope by org_id in code, so a single service-role policy is enough.
DROP POLICY IF EXISTS "Service role can manage pending_sms_approvals" ON pending_sms_approvals;
CREATE POLICY "Service role can manage pending_sms_approvals" ON pending_sms_approvals
  FOR ALL USING (auth.role() = 'service_role');
