-- Quick fix for immediate testing
-- This updates all existing clients to have updated_at = created_at so they show some activity

-- First add the column if it doesn't exist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Update existing records to have updated_at = created_at
UPDATE clients 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Create the trigger function and trigger for future updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update the client_activity view to include client created/updated dates
CREATE OR REPLACE VIEW client_activity AS
SELECT
  c.id as client_id,
  GREATEST(
    COALESCE((SELECT MAX(d.created_at) FROM deals d WHERE d.client_id = c.id), c.created_at),
    COALESCE((SELECT MAX(n.created_at) FROM notes n WHERE n.relates_to='client' AND n.relates_id = c.id), c.created_at),
    COALESCE((SELECT MAX(i.issued_at) FROM invoices i WHERE i.client_id = c.id), c.created_at),
    COALESCE((SELECT MAX(t.created_at) FROM tasks t WHERE t.relates_to='client' AND t.relates_id = c.id), c.created_at),
    c.updated_at,
    c.created_at
  ) as last_activity_at,
  COALESCE((
    SELECT COUNT(*) FROM deals d
    WHERE d.client_id = c.id AND d.stage NOT IN ('Won','Lost')
  ), 0) as open_deals_count,
  (
    SELECT MIN(t.due_at) FROM tasks t
    WHERE t.relates_to='client' AND t.relates_id = c.id AND COALESCE(t.done, false) = false AND t.due_at IS NOT NULL
  ) as next_task_due_at
FROM clients c;