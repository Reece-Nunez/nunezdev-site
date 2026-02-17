-- Add column to store Stripe Payment Link ID
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link text;