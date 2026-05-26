-- Adds qualifying fields captured by the public lead/audit forms
-- (currently sent in the notification email but not stored on the lead row),
-- plus a client_id link for the lead-to-client conversion flow.
--
-- Applied via Supabase MCP on 2026-05-26.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS project_type TEXT,
  ADD COLUMN IF NOT EXISTS budget TEXT,
  ADD COLUMN IF NOT EXISTS timeline TEXT,
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_source ON leads(lead_source);

-- Add 'contacted' as an intermediate state between new and qualified so the
-- dashboard can track post-call follow-up. Old 'nurturing' stays valid for
-- backward compat with the email-nurture pipeline.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'contacted', 'nurturing', 'qualified', 'converted', 'lost'));
