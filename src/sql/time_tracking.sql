-- Time Tracking Migration
-- Run this in Supabase SQL Editor

-- Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Link to client (optional - for unbillable/internal work)
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Link to invoice if billed
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Time entry details
  description TEXT NOT NULL,

  -- Time tracking
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 0,

  -- Date for manual entries (when not using timer)
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Billing
  billable BOOLEAN NOT NULL DEFAULT true,
  hourly_rate_cents INTEGER, -- Override rate, null = use default
  amount_cents INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN billable AND hourly_rate_cents IS NOT NULL
      THEN ROUND((duration_minutes / 60.0) * hourly_rate_cents)
      ELSE 0
    END
  ) STORED,

  -- Status
  status TEXT NOT NULL DEFAULT 'logged' CHECK (status IN ('running', 'logged', 'billed')),

  -- Project/category tagging
  project TEXT,
  tags TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_org_id ON time_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice_id ON time_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date ON time_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON time_entries(billable) WHERE billable = true;

-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view time entries in their org" ON time_entries
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert time entries in their org" ON time_entries
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member')
    )
  );

CREATE POLICY "Users can update time entries in their org" ON time_entries
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member')
    )
  );

CREATE POLICY "Users can delete time entries in their org" ON time_entries
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member')
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_time_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_time_entries_updated_at();

-- View for time tracking stats
CREATE OR REPLACE VIEW time_tracking_stats AS
SELECT
  org_id,
  -- This week
  COALESCE(SUM(duration_minutes) FILTER (
    WHERE entry_date >= date_trunc('week', CURRENT_DATE)
  ), 0) AS this_week_minutes,
  COALESCE(SUM(duration_minutes) FILTER (
    WHERE entry_date >= date_trunc('week', CURRENT_DATE) AND billable = true
  ), 0) AS this_week_billable_minutes,
  -- This month
  COALESCE(SUM(duration_minutes) FILTER (
    WHERE entry_date >= date_trunc('month', CURRENT_DATE)
  ), 0) AS this_month_minutes,
  COALESCE(SUM(duration_minutes) FILTER (
    WHERE entry_date >= date_trunc('month', CURRENT_DATE) AND billable = true
  ), 0) AS this_month_billable_minutes,
  -- Unbilled
  COALESCE(SUM(duration_minutes) FILTER (
    WHERE billable = true AND status = 'logged'
  ), 0) AS unbilled_minutes,
  COALESCE(SUM(amount_cents) FILTER (
    WHERE billable = true AND status = 'logged'
  ), 0) AS unbilled_amount_cents,
  -- Today
  COALESCE(SUM(duration_minutes) FILTER (
    WHERE entry_date = CURRENT_DATE
  ), 0) AS today_minutes
FROM time_entries
GROUP BY org_id;

-- Grant access to the view
GRANT SELECT ON time_tracking_stats TO authenticated;

-- Helper function to format duration
CREATE OR REPLACE FUNCTION format_duration(minutes INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF minutes < 60 THEN
    RETURN minutes || 'm';
  ELSE
    RETURN FLOOR(minutes / 60) || 'h ' || (minutes % 60) || 'm';
  END IF;
END;
$$ LANGUAGE plpgsql;
