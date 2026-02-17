-- Add column to store Stripe's hosted invoice URL for payments
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_hosted_invoice_url text;