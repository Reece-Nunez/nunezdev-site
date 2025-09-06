-- Add HubSpot invoice support to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hubspot_invoice_id text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_hubspot_invoice_id ON invoices(hubspot_invoice_id);

-- Update the source column to allow hubspot values
-- (assuming source column exists and has constraints)