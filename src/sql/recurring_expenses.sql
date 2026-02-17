-- Recurring Expenses table for tracking monthly/recurring expenses
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Basic info
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,

  -- Schedule
  frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, quarterly, annually
  day_of_month INTEGER DEFAULT 1, -- Day to generate expense (1-28 recommended)
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE, -- NULL means no end

  -- Categorization
  category TEXT NOT NULL DEFAULT 'other',

  -- Optional client linkage
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  is_billable BOOLEAN DEFAULT false,

  -- Tax tracking
  is_tax_deductible BOOLEAN DEFAULT true,
  tax_category TEXT,

  -- Payment info
  payment_method TEXT,
  vendor TEXT,

  -- Notes
  notes TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_generated_date DATE, -- Track when we last generated an expense

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_org_id ON recurring_expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(is_active) WHERE is_active = true;

-- RLS policies
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org recurring expenses"
  ON recurring_expenses FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own org recurring expenses"
  ON recurring_expenses FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org recurring expenses"
  ON recurring_expenses FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own org recurring expenses"
  ON recurring_expenses FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_recurring_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recurring_expenses_updated_at ON recurring_expenses;
CREATE TRIGGER recurring_expenses_updated_at
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_expenses_updated_at();

-- Add recurring_expense_id to expenses table to track generated expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring_expense_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL;
