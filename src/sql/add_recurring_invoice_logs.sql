-- Recurring Invoice Activity Logs
-- Tracks all events related to recurring invoice processing for visibility and debugging

CREATE TABLE IF NOT EXISTS recurring_invoice_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recurring_invoice_id uuid REFERENCES recurring_invoices(id) ON DELETE SET NULL,
    invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
    event_type text NOT NULL CHECK (event_type IN (
        'processing_started', 'processing_completed',
        'invoice_created', 'email_sent', 'email_failed',
        'stripe_link_created', 'stripe_link_failed',
        'payment_received', 'payment_failed',
        'invoice_opened',
        'skipped', 'completed', 'error'
    )),
    status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped', 'info')),
    message text NOT NULL,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_logs_org_id ON recurring_invoice_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_logs_recurring_id ON recurring_invoice_logs(recurring_invoice_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_logs_event_type ON recurring_invoice_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_logs_created_at ON recurring_invoice_logs(created_at DESC);

-- RLS policies
ALTER TABLE recurring_invoice_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for their org"
    ON recurring_invoice_logs FOR SELECT
    USING (org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Service role can insert logs"
    ON recurring_invoice_logs FOR INSERT
    WITH CHECK (true);

-- Fix client_activity_log CHECK constraint to include 'recurring_invoice_sent'
-- The process route already inserts this type but the constraint may reject it
ALTER TABLE client_activity_log DROP CONSTRAINT IF EXISTS client_activity_log_activity_type_check;
ALTER TABLE client_activity_log ADD CONSTRAINT client_activity_log_activity_type_check
    CHECK (activity_type IN (
        'invoice_viewed', 'invoice_downloaded', 'contract_signed',
        'payment_initiated', 'payment_completed', 'payment_failed',
        'payment_link_clicked', 'email_opened', 'email_sent',
        'recurring_invoice_sent'
    ));
