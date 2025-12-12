-- Expenses table for tracking business expenses
-- Run this in Supabase SQL Editor

-- Create expense categories enum-like table or use text with common values
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Basic info
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Categorization
  category TEXT NOT NULL DEFAULT 'other',
  -- Common categories: software, hardware, hosting, marketing, travel, office, meals, professional_services, insurance, utilities, other

  -- Optional client/project linkage (for billable expenses)
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  is_billable BOOLEAN DEFAULT false,
  is_billed BOOLEAN DEFAULT false,

  -- Tax tracking
  is_tax_deductible BOOLEAN DEFAULT true,
  tax_category TEXT, -- For tax reporting: business_expense, home_office, vehicle, etc.

  -- Payment info
  payment_method TEXT, -- card, cash, bank_transfer, paypal, etc.
  vendor TEXT, -- Who was paid (e.g., "AWS", "Adobe", "Office Depot")

  -- Receipt
  receipt_url TEXT, -- URL to uploaded receipt image/PDF
  receipt_filename TEXT,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_expenses_org_id ON expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_client_id ON expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_is_billable ON expenses(is_billable) WHERE is_billable = true;

-- RLS policies
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see expenses for their organization
CREATE POLICY "Users can view own org expenses"
  ON expenses FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert expenses for their organization
CREATE POLICY "Users can insert own org expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update expenses for their organization
CREATE POLICY "Users can update own org expenses"
  ON expenses FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete expenses for their organization
CREATE POLICY "Users can delete own org expenses"
  ON expenses FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_updated_at ON expenses;
CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

-- View for expense summaries by category
CREATE OR REPLACE VIEW expense_summary_by_category AS
SELECT
  org_id,
  category,
  COUNT(*) as expense_count,
  SUM(amount_cents) as total_cents,
  MIN(expense_date) as first_expense,
  MAX(expense_date) as last_expense
FROM expenses
GROUP BY org_id, category;

-- View for monthly expense totals
CREATE OR REPLACE VIEW expense_summary_by_month AS
SELECT
  org_id,
  DATE_TRUNC('month', expense_date) as month,
  COUNT(*) as expense_count,
  SUM(amount_cents) as total_cents,
  SUM(CASE WHEN is_tax_deductible THEN amount_cents ELSE 0 END) as tax_deductible_cents,
  SUM(CASE WHEN is_billable AND NOT is_billed THEN amount_cents ELSE 0 END) as unbilled_cents
FROM expenses
GROUP BY org_id, DATE_TRUNC('month', expense_date);
