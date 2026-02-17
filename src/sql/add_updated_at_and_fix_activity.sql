-- Add updated_at column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists and create it
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update client_activity view to include client updates in last_activity_at
CREATE OR REPLACE VIEW client_activity AS
SELECT
  c.id as client_id,
  CASE 
    WHEN GREATEST(
      COALESCE((SELECT MAX(d.created_at) FROM deals d WHERE d.client_id = c.id), '1900-01-01'::timestamptz),
      COALESCE((SELECT MAX(n.created_at) FROM notes n WHERE n.relates_to='client' AND n.relates_id = c.id), '1900-01-01'::timestamptz),
      COALESCE((SELECT MAX(i.issued_at) FROM invoices i WHERE i.client_id = c.id), '1900-01-01'::timestamptz),
      COALESCE((SELECT MAX(t.created_at) FROM tasks t WHERE t.relates_to='client' AND t.relates_id = c.id), '1900-01-01'::timestamptz),
      COALESCE(c.updated_at, '1900-01-01'::timestamptz),
      COALESCE(c.created_at, '1900-01-01'::timestamptz)
    ) = '1900-01-01'::timestamptz 
    THEN NULL
    ELSE GREATEST(
      COALESCE((SELECT MAX(d.created_at) FROM deals d WHERE d.client_id = c.id), '1900-01-01'::timestamptz),
      COALESCE((SELECT MAX(n.created_at) FROM notes n WHERE n.relates_to='client' AND n.relates_id = c.id), '1900-01-01'::timestamptz),
      COALESCE((SELECT MAX(i.issued_at) FROM invoices i WHERE i.client_id = c.id), '1900-01-01'::timestamptz),
      COALESCE((SELECT MAX(t.created_at) FROM tasks t WHERE t.relates_to='client' AND t.relates_id = c.id), '1900-01-01'::timestamptz),
      COALESCE(c.updated_at, '1900-01-01'::timestamptz),
      COALESCE(c.created_at, '1900-01-01'::timestamptz)
    )
  END as last_activity_at,
  COALESCE((
    SELECT COUNT(*) FROM deals d
    WHERE d.client_id = c.id AND d.stage NOT IN ('Won','Lost')
  ), 0) as open_deals_count,
  (
    SELECT MIN(t.due_at) FROM tasks t
    WHERE t.relates_to='client' AND t.relates_id = c.id AND COALESCE(t.done, false) = false AND t.due_at IS NOT NULL
  ) as next_task_due_at
FROM clients c;