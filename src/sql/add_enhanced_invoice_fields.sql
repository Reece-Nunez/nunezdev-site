-- Add enhanced invoice fields for comprehensive invoice templates
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_overview text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_start_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type text check (discount_type in ('percentage', 'fixed'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_value numeric;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS technology_stack text[]; -- Array of technologies
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_conditions text;

-- Ensure discount_cents column exists (should already exist but ensure it's there)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_cents integer default 0;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_project_dates ON invoices(project_start_date, delivery_date);
CREATE INDEX IF NOT EXISTS idx_invoices_discount_type ON invoices(discount_type);