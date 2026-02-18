-- Add stripe_fee_cents column to track Stripe processing fees per payment
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS stripe_fee_cents integer DEFAULT 0;
