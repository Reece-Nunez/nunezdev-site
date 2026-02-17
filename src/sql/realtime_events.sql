-- Real-time Events Table for SSE
-- Stores events that need to be pushed to connected clients in real-time

CREATE TABLE IF NOT EXISTS realtime_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN (
        'payment_received',
        'invoice_paid',
        'installment_paid',
        'invoice_viewed',
        'contract_signed',
        'invoice_sent',
        'client_created'
    )),
    event_data jsonb NOT NULL DEFAULT '{}',
    -- Reference IDs for filtering
    invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
    client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
    -- Tracking
    created_at timestamptz DEFAULT now(),
    -- Events expire after 5 minutes (clients only need recent events)
    expires_at timestamptz DEFAULT now() + INTERVAL '5 minutes'
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_realtime_events_org_id ON realtime_events(org_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_created_at ON realtime_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_events_expires_at ON realtime_events(expires_at);
CREATE INDEX IF NOT EXISTS idx_realtime_events_invoice_id ON realtime_events(invoice_id);

-- Auto-cleanup function to remove expired events (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_realtime_events()
RETURNS void AS $$
BEGIN
    DELETE FROM realtime_events WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS realtime_events_org_policy ON realtime_events;
DROP POLICY IF EXISTS realtime_events_service_policy ON realtime_events;
DROP POLICY IF EXISTS realtime_events_select_policy ON realtime_events;
DROP POLICY IF EXISTS realtime_events_service_all ON realtime_events;

-- Policy: Authenticated users can see events for their organization
CREATE POLICY realtime_events_select_policy ON realtime_events
    FOR SELECT
    TO authenticated
    USING (org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
    ));

-- Policy: Service role can insert/update/delete (for webhooks)
CREATE POLICY realtime_events_service_all ON realtime_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
