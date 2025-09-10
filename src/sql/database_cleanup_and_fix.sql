-- =====================================
-- COMPREHENSIVE DATABASE CLEANUP & FIX
-- =====================================
-- This script fixes all the inconsistencies in your Supabase database
-- Run this after backing up your data!

-- Step 1: Drop all conflicting views and recreate them properly
DROP VIEW IF EXISTS clients_overview CASCADE;
DROP VIEW IF EXISTS client_activity CASCADE; 
DROP VIEW IF EXISTS client_financials CASCADE;
DROP VIEW IF EXISTS client_deal_current CASCADE;
DROP VIEW IF EXISTS invoice_payment_summary CASCADE;

-- Step 2: Fix all missing constraints and add proper indexes
-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_deals_client_id ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_org_id ON deals(org_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_notes_relates_to_id ON notes(relates_to, relates_id);
CREATE INDEX IF NOT EXISTS idx_notes_org_id ON notes(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_relates_to_id ON tasks(relates_to, relates_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_paid_at ON invoice_payments(paid_at);

-- Step 3: Ensure all tables have proper updated_at triggers
-- Create the updated_at function once
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at columns where missing
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE deals ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create updated_at triggers (drop existing first to avoid conflicts)
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 4: Fix invoice payments system
-- Ensure all invoices have the correct payment tracking columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_paid_cents integer DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS remaining_balance_cents integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Update constraint to include all payment statuses
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
    CHECK (status IN ('draft','sent','paid','void','overdue','partially_paid'));

-- Step 5: Recalculate all payment totals to fix KPI mismatches
-- First, set default values for remaining_balance_cents
UPDATE invoices 
SET remaining_balance_cents = amount_cents 
WHERE remaining_balance_cents IS NULL;

-- Then recalculate everything based on actual payments
UPDATE invoices 
SET 
    total_paid_cents = COALESCE(payment_totals.total_paid, 0),
    remaining_balance_cents = GREATEST(amount_cents - COALESCE(payment_totals.total_paid, 0), 0),
    status = CASE 
        WHEN COALESCE(payment_totals.total_paid, 0) = 0 THEN 
            CASE WHEN status IN ('paid', 'partially_paid') THEN 'sent' ELSE status END
        WHEN COALESCE(payment_totals.total_paid, 0) >= amount_cents THEN 'paid'
        WHEN COALESCE(payment_totals.total_paid, 0) > 0 AND COALESCE(payment_totals.total_paid, 0) < amount_cents THEN 'partially_paid'
        ELSE status
    END,
    paid_at = CASE 
        WHEN COALESCE(payment_totals.total_paid, 0) >= amount_cents THEN COALESCE(paid_at, now())
        ELSE NULL
    END
FROM (
    SELECT 
        invoice_id,
        SUM(amount_cents) as total_paid
    FROM invoice_payments 
    GROUP BY invoice_id
) as payment_totals
WHERE invoices.id = payment_totals.invoice_id;

-- Step 6: Create the definitive, optimized views for consistent KPIs

-- Latest active deal per client
CREATE VIEW client_deal_current AS
WITH ranked_deals AS (
  SELECT
    d.*,
    ROW_NUMBER() OVER (
      PARTITION BY d.client_id
      ORDER BY 
        CASE WHEN d.stage IN ('Won','Lost') THEN 1 ELSE 0 END,
        d.created_at DESC
    ) AS rank
  FROM deals d
)
SELECT * FROM ranked_deals WHERE rank = 1;

-- Client financials with consistent payment calculations
CREATE VIEW client_financials AS
SELECT
  c.id AS client_id,
  -- Total invoiced (all non-draft invoices)
  COALESCE(SUM(
    CASE WHEN i.status IN ('sent','paid','overdue','partially_paid','void') 
    THEN i.amount_cents 
    ELSE 0 END
  ), 0) AS total_invoiced_cents,
  
  -- Total paid (use the maintained total_paid_cents column)
  COALESCE(SUM(
    CASE WHEN i.status IN ('sent','paid','overdue','partially_paid') 
    THEN COALESCE(i.total_paid_cents, 0)
    ELSE 0 END
  ), 0) AS total_paid_cents,
  
  -- Balance due (use the maintained remaining_balance_cents column)
  COALESCE(SUM(
    CASE WHEN i.status IN ('sent','overdue','partially_paid')
    THEN COALESCE(i.remaining_balance_cents, i.amount_cents)
    ELSE 0 END
  ), 0) AS balance_due_cents,
  
  -- Draft invoices (separate from main totals)
  COALESCE(SUM(
    CASE WHEN i.status = 'draft' 
    THEN i.amount_cents 
    ELSE 0 END
  ), 0) AS draft_invoiced_cents

FROM clients c
LEFT JOIN invoices i ON i.client_id = c.id
GROUP BY c.id;

-- Client activity tracking
CREATE VIEW client_activity AS
SELECT
  c.id AS client_id,
  GREATEST(
    COALESCE((SELECT MAX(d.created_at) FROM deals d WHERE d.client_id = c.id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(n.created_at) FROM notes n WHERE n.relates_to='client' AND n.relates_id = c.id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(i.issued_at) FROM invoices i WHERE i.client_id = c.id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(t.created_at) FROM tasks t WHERE t.relates_to='client' AND t.relates_id = c.id), '1970-01-01'::timestamptz),
    c.created_at
  ) AS last_activity_at,
  
  -- Count of open deals
  COALESCE((
    SELECT COUNT(*) FROM deals d
    WHERE d.client_id = c.id AND d.stage NOT IN ('Won','Lost')
  ), 0) AS open_deals_count,
  
  -- Next task due
  (
    SELECT MIN(t.due_at) FROM tasks t
    WHERE t.relates_to='client' 
      AND t.relates_id = c.id 
      AND t.done = false 
      AND t.due_at IS NOT NULL
      AND t.due_at > now()
  ) AS next_task_due_at

FROM clients c;

-- Master clients overview for dashboards and reports
CREATE VIEW clients_overview AS
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
  c.updated_at,
  
  -- Financial metrics
  COALESCE(cf.total_invoiced_cents, 0) AS total_invoiced_cents,
  COALESCE(cf.total_paid_cents, 0) AS total_paid_cents,
  COALESCE(cf.balance_due_cents, 0) AS balance_due_cents,
  COALESCE(cf.draft_invoiced_cents, 0) AS draft_invoiced_cents,
  
  -- Deal information
  cdc.stage AS current_deal_stage,
  cdc.value_cents AS current_deal_value_cents,
  cdc.probability AS current_deal_probability,
  
  -- Activity metrics
  ca.last_activity_at,
  ca.open_deals_count,
  ca.next_task_due_at

FROM clients c
LEFT JOIN client_financials cf ON cf.client_id = c.id
LEFT JOIN client_deal_current cdc ON cdc.client_id = c.id
LEFT JOIN client_activity ca ON ca.client_id = c.id;

-- Step 7: Create payment summary view for detailed analysis
CREATE VIEW invoice_payment_summary AS
SELECT
  i.id AS invoice_id,
  i.org_id,
  i.client_id,
  i.stripe_invoice_id,
  i.status,
  i.amount_cents,
  i.total_paid_cents,
  i.remaining_balance_cents,
  i.issued_at,
  i.due_at,
  i.paid_at,
  
  -- Payment details
  COALESCE(p.payment_count, 0) AS payment_count,
  p.first_payment_at,
  p.last_payment_at,
  
  -- Status indicators
  CASE 
    WHEN i.status = 'paid' THEN true 
    ELSE false 
  END AS is_fully_paid,
  
  CASE 
    WHEN i.status = 'partially_paid' THEN true 
    ELSE false 
  END AS is_partially_paid,
  
  CASE 
    WHEN i.status IN ('sent', 'overdue') AND i.due_at < now() THEN true 
    ELSE false 
  END AS is_overdue

FROM invoices i
LEFT JOIN (
  SELECT 
    invoice_id,
    COUNT(*) AS payment_count,
    MIN(paid_at) AS first_payment_at,
    MAX(paid_at) AS last_payment_at
  FROM invoice_payments
  GROUP BY invoice_id
) p ON p.invoice_id = i.id;

-- Step 8: Enable RLS (Row Level Security) policies for multi-tenancy
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (you may need to adjust based on your auth setup)
-- Users can only see data from organizations they belong to

-- Organizations policy
CREATE POLICY "Users can see organizations they belong to" ON organizations
    FOR ALL USING (
        id IN (
            SELECT org_id FROM org_members 
            WHERE user_id = auth.uid()
        )
    );

-- Clients policy
CREATE POLICY "Users can see clients from their organizations" ON clients
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM org_members 
            WHERE user_id = auth.uid()
        )
    );

-- Similar policies for other tables
CREATE POLICY "Users can see deals from their organizations" ON deals
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM org_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can see notes from their organizations" ON notes
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM org_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can see tasks from their organizations" ON tasks
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM org_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can see invoices from their organizations" ON invoices
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM org_members 
            WHERE user_id = auth.uid()
        )
    );

-- Grant appropriate permissions to authenticated users
GRANT ALL ON organizations TO authenticated;
GRANT ALL ON org_members TO authenticated;
GRANT ALL ON clients TO authenticated;
GRANT ALL ON deals TO authenticated;
GRANT ALL ON notes TO authenticated;
GRANT ALL ON tasks TO authenticated;
GRANT ALL ON invoices TO authenticated;
GRANT ALL ON invoice_payments TO authenticated;

-- Grant SELECT on views
GRANT SELECT ON clients_overview TO authenticated;
GRANT SELECT ON client_financials TO authenticated;
GRANT SELECT ON client_activity TO authenticated;
GRANT SELECT ON client_deal_current TO authenticated;
GRANT SELECT ON invoice_payment_summary TO authenticated;

-- Step 9: Final data consistency check
-- This will show any remaining inconsistencies
SELECT 
    'Data Consistency Check Complete' AS status,
    COUNT(*) AS total_invoices,
    SUM(CASE WHEN total_paid_cents IS NULL THEN 1 ELSE 0 END) AS invoices_missing_payment_totals,
    SUM(CASE WHEN remaining_balance_cents IS NULL THEN 1 ELSE 0 END) AS invoices_missing_balance
FROM invoices;

-- Show summary of fixed data
SELECT 
    'Summary' AS report_type,
    (SELECT COUNT(*) FROM clients) AS total_clients,
    (SELECT COUNT(*) FROM deals) AS total_deals,
    (SELECT COUNT(*) FROM invoices) AS total_invoices,
    (SELECT COUNT(*) FROM invoice_payments) AS total_payments,
    (SELECT SUM(amount_cents) FROM invoices WHERE status != 'draft') AS total_invoiced_cents,
    (SELECT SUM(total_paid_cents) FROM invoices) AS total_paid_cents;