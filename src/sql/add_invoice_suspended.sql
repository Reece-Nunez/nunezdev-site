-- Add is_suspended column to invoices table
-- When suspended, invoices are excluded from analytics, email reminders, and followups
-- They can be reactivated at any time

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Index for efficient filtering of non-suspended invoices
CREATE INDEX IF NOT EXISTS idx_invoices_is_suspended ON invoices (is_suspended) WHERE is_suspended = true;

COMMENT ON COLUMN invoices.is_suspended IS 'When true, invoice is frozen - excluded from analytics, reminders, and followups';
COMMENT ON COLUMN invoices.suspended_at IS 'Timestamp when the invoice was suspended';
