-- Extend invoices table for detailed HubSpot quote information
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_schedule jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quote_template text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'USD';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_cents integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_cents integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_cents integer;

-- Add Stripe transaction linking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_charge_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_hubspot_quote_id ON invoices(hubspot_quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent_id ON invoices(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_charge_id ON invoices(stripe_charge_id);