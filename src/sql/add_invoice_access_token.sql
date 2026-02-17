-- Add secure access token for client invoice viewing
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS access_token text;

-- Create unique index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_invoices_access_token ON invoices(access_token);

-- Generate tokens for existing invoices (optional)
UPDATE invoices 
SET access_token = encode(gen_random_bytes(32), 'hex')
WHERE access_token IS NULL;