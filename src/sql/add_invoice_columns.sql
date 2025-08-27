-- Add missing columns to invoices table for enhanced invoice functionality
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS require_signature boolean default false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signer_name text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signer_email text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hosted_invoice_url text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS brand_logo_url text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS brand_primary text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at timestamptz default now();

-- Add unique constraint for invoice_number
ALTER TABLE invoices ADD CONSTRAINT unique_invoice_number_per_org UNIQUE (org_id, invoice_number);

-- Add index for invoice_number lookups
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);