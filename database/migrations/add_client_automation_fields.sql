-- Add fields to clients table for report automation
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS ga4_property_id TEXT,
  ADD COLUMN IF NOT EXISTS vercel_project_id TEXT;

-- Recreate clients_overview to include the new columns
CREATE OR REPLACE VIEW clients_overview AS
SELECT
  c.id,
  c.org_id,
  c.name,
  c.email,
  c.phone,
  c.company,
  c.status,
  c.tags,
  c.created_at,
  c.website_url,
  c.ga4_property_id,
  c.vercel_project_id,
  coalesce(cf.total_invoiced_cents, 0) as total_invoiced_cents,
  coalesce(cf.total_paid_cents, 0) as total_paid_cents,
  coalesce(cf.balance_due_cents, 0) as balance_due_cents,
  coalesce(cf.draft_invoiced_cents, 0) as draft_invoiced_cents,
  cdc.stage as current_stage,
  ca.last_activity_at,
  ca.open_deals_count,
  ca.next_task_due_at
FROM clients c
LEFT JOIN client_financials cf ON cf.client_id = c.id
LEFT JOIN client_deal_current cdc ON cdc.client_id = c.id
LEFT JOIN client_activity ca ON ca.client_id = c.id;
