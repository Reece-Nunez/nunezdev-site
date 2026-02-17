-- Create invoice followups table
CREATE TABLE IF NOT EXISTS invoice_followups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL,
  followup_type VARCHAR(50) NOT NULL CHECK (followup_type IN ('gentle', 'firm', 'final', 'manual')),
  days_overdue INTEGER NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  custom_message TEXT, -- For manual follow-ups
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_followups_invoice_id ON invoice_followups(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_followups_type ON invoice_followups(followup_type);
CREATE INDEX IF NOT EXISTS idx_invoice_followups_sent_at ON invoice_followups(sent_at);

-- Add foreign key constraint if invoices table exists
-- ALTER TABLE invoice_followups ADD CONSTRAINT fk_invoice_followups_invoice
-- FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

-- RLS policies
ALTER TABLE invoice_followups ENABLE ROW LEVEL SECURITY;

-- Allow service role to access everything
CREATE POLICY "Service role can manage invoice_followups" ON invoice_followups FOR ALL USING (auth.role() = 'service_role');