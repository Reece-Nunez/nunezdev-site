-- Fix missing RLS policies for invoice_payment_plans, client_activity_log, notification_preferences
-- These tables had RLS enabled but no policies, blocking all operations from authenticated users

-- invoice_payment_plans: allow access via org membership through the invoices table
ALTER TABLE invoice_payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage payment plans for their org invoices"
  ON invoice_payment_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN org_members om ON om.org_id = i.org_id
      WHERE i.id = invoice_payment_plans.invoice_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to invoice_payment_plans"
  ON invoice_payment_plans FOR ALL
  USING (auth.role() = 'service_role');

-- client_activity_log: allow access via org membership through the invoices table
ALTER TABLE client_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity for their org invoices"
  ON client_activity_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN org_members om ON om.org_id = i.org_id
      WHERE i.id = client_activity_log.invoice_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to client_activity_log"
  ON client_activity_log FOR ALL
  USING (auth.role() = 'service_role');

-- notification_preferences: allow access via org membership
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage notification preferences for their org"
  ON notification_preferences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = notification_preferences.org_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to notification_preferences"
  ON notification_preferences FOR ALL
  USING (auth.role() = 'service_role');
