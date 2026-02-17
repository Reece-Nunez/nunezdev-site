-- Add delivery_date column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_date date;