-- In-app notifications table for the dashboard bell icon
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'invoice_sent',
    'invoice_paid',
    'invoice_partially_paid',
    'payment_overdue',
    'contract_signed',
    'proposal_accepted',
    'file_uploaded'
  )),
  title text NOT NULL,
  body text,
  link text,
  read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Fast lookup for unread count badge
CREATE INDEX IF NOT EXISTS idx_notifications_org_unread
  ON notifications(org_id, read) WHERE read = false;

-- Fast lookup for listing recent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_org_created
  ON notifications(org_id, created_at DESC);

-- RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read own notifications"
  ON notifications FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org members can update own notifications"
  ON notifications FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Service role can insert (API routes use supabaseServer which bypasses RLS,
-- but this is here for completeness if RLS is enforced)
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
