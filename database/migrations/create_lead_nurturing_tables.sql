-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(255),
  source VARCHAR(50) NOT NULL CHECK (source IN ('contact_form', 'appointment', 'manual')),
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'nurturing', 'qualified', 'converted', 'lost')),
  last_contact TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_followup TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scheduled emails table
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  subject VARCHAR(500) NOT NULL,
  template VARCHAR(100) NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email sequences table (for future use)
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  trigger_event VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sequence emails table (for future use)
CREATE TABLE IF NOT EXISTS sequence_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject VARCHAR(500) NOT NULL,
  template VARCHAR(100) NOT NULL,
  conditions JSONB,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lead interactions table
CREATE TABLE IF NOT EXISTS lead_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  interaction_type VARCHAR(100) NOT NULL, -- 'email_sent', 'email_opened', 'link_clicked', 'appointment_booked', etc.
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_for ON scheduled_emails(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead_id ON lead_interactions(lead_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for leads table
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies (adjust based on your auth setup)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions ENABLE ROW LEVEL SECURITY;

-- Allow service role to access everything
CREATE POLICY "Service role can manage leads" ON leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage scheduled_emails" ON scheduled_emails FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage email_sequences" ON email_sequences FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage sequence_emails" ON sequence_emails FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage lead_interactions" ON lead_interactions FOR ALL USING (auth.role() = 'service_role');