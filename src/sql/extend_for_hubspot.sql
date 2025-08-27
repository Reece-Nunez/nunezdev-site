-- Extend invoices table to support HubSpot quotes
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hubspot_quote_id text UNIQUE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add trigger to update invoices updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_invoices_updated_at_trigger ON invoices;
CREATE TRIGGER update_invoices_updated_at_trigger
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_invoices_updated_at();

-- Extend deals table to support HubSpot deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS hubspot_deal_id text UNIQUE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add trigger to update deals updated_at
CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_deals_updated_at_trigger ON deals;
CREATE TRIGGER update_deals_updated_at_trigger
    BEFORE UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_deals_updated_at();

-- Update deals stage enum to match HubSpot values
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;
ALTER TABLE deals ADD CONSTRAINT deals_stage_check 
    CHECK (stage IN ('New','Discovery','Proposal','Negotiation','Won','Lost','Qualified','Appointment','Contract','Closed'));

-- Add HubSpot contact ID to clients for better matching
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hubspot_contact_id text UNIQUE;