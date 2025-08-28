-- Payment Plans System with Notifications
-- This allows for flexible payment splits (50/50, 40/30/30, custom) with individual payment links

-- Create payment plans table for split payments
CREATE TABLE IF NOT EXISTS invoice_payment_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    plan_type text NOT NULL CHECK (plan_type IN ('full', '50_50', '40_30_30', 'custom')),
    installment_number integer NOT NULL, -- 1, 2, 3, etc.
    installment_label text NOT NULL, -- "Full Payment", "First Payment (50%)", "Down Payment", etc.
    amount_cents integer NOT NULL,
    due_date date,
    grace_period_days integer DEFAULT 0, -- Grace period after due date
    stripe_payment_link_id text, -- Each installment gets its own Stripe payment link
    stripe_payment_link_url text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'overdue')),
    paid_at timestamptz,
    stripe_payment_intent_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(invoice_id, installment_number)
);

-- Create indexes for payment plans
CREATE INDEX IF NOT EXISTS idx_payment_plans_invoice_id ON invoice_payment_plans(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_stripe_payment_link_id ON invoice_payment_plans(stripe_payment_link_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON invoice_payment_plans(status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_due_date ON invoice_payment_plans(due_date);

-- Add payment plan fields to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_plan_type text DEFAULT 'full' CHECK (payment_plan_type IN ('full', '50_50', '40_30_30', 'custom'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_plan_enabled boolean DEFAULT false;

-- Client Activity Tracking & Notifications
CREATE TABLE IF NOT EXISTS client_activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    activity_type text NOT NULL CHECK (activity_type IN (
        'invoice_viewed', 'invoice_downloaded', 'contract_signed', 
        'payment_initiated', 'payment_completed', 'payment_failed',
        'payment_link_clicked', 'email_opened'
    )),
    activity_data jsonb, -- Store additional data like payment amount, IP address, etc.
    user_agent text,
    ip_address inet,
    created_at timestamptz DEFAULT now()
);

-- Create indexes for activity log
CREATE INDEX IF NOT EXISTS idx_activity_log_invoice_id ON client_activity_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_client_id ON client_activity_log(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_activity_type ON client_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON client_activity_log(created_at);

-- Notification Preferences for business owner
CREATE TABLE IF NOT EXISTS notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    notification_type text NOT NULL CHECK (notification_type IN (
        'contract_signed', 'payment_received', 'invoice_viewed', 
        'payment_failed', 'payment_overdue', 'all_payments_completed'
    )),
    email_enabled boolean DEFAULT true,
    webhook_enabled boolean DEFAULT false,
    webhook_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(org_id, notification_type)
);

-- Create trigger for payment_plans updated_at
CREATE OR REPLACE FUNCTION update_payment_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_payment_plans_updated_at_trigger ON invoice_payment_plans;
CREATE TRIGGER update_payment_plans_updated_at_trigger
    BEFORE UPDATE ON invoice_payment_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_plans_updated_at();

-- Function to create notification when client activity occurs
CREATE OR REPLACE FUNCTION create_activity_notification()
RETURNS TRIGGER AS $$
DECLARE
    org_record RECORD;
    notification_enabled boolean := false;
BEGIN
    -- Get organization from invoice
    SELECT o.id, o.name INTO org_record 
    FROM organizations o 
    JOIN invoices i ON i.org_id = o.id 
    WHERE i.id = NEW.invoice_id;
    
    -- Check if notifications are enabled for this activity type
    SELECT email_enabled INTO notification_enabled
    FROM notification_preferences 
    WHERE org_id = org_record.id 
    AND notification_type = NEW.activity_type;
    
    -- If notifications are enabled, you can add email sending logic here
    -- For now, just log that a notification should be sent
    IF notification_enabled THEN
        -- Future: Add email notification logic
        -- send_notification_email(org_record.id, NEW.activity_type, NEW.activity_data);
        NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for activity notifications
DROP TRIGGER IF EXISTS create_activity_notification_trigger ON client_activity_log;
CREATE TRIGGER create_activity_notification_trigger
    AFTER INSERT ON client_activity_log
    FOR EACH ROW
    EXECUTE FUNCTION create_activity_notification();

-- Function to update payment plan status based on due dates
CREATE OR REPLACE FUNCTION update_payment_plan_status()
RETURNS void AS $$
BEGIN
    -- Mark payments as overdue if past due date + grace period
    UPDATE invoice_payment_plans 
    SET status = 'overdue'
    WHERE status = 'pending' 
    AND due_date IS NOT NULL 
    AND due_date + INTERVAL '1 day' * COALESCE(grace_period_days, 0) < CURRENT_DATE;
    
    -- Mark payments back to pending if they were overdue but are now within grace period
    UPDATE invoice_payment_plans 
    SET status = 'pending'
    WHERE status = 'overdue' 
    AND due_date IS NOT NULL 
    AND due_date + INTERVAL '1 day' * COALESCE(grace_period_days, 0) >= CURRENT_DATE;
END;
$$ language 'plpgsql';

-- Insert default notification preferences for existing organizations
INSERT INTO notification_preferences (org_id, notification_type, email_enabled)
SELECT o.id, notification_type, true
FROM organizations o
CROSS JOIN (
    VALUES 
    ('contract_signed'),
    ('payment_received'),
    ('invoice_viewed'),
    ('payment_failed'),
    ('payment_overdue'),
    ('all_payments_completed')
) AS nt(notification_type)
ON CONFLICT (org_id, notification_type) DO NOTHING;

-- Create a view for easy payment plan summary
CREATE OR REPLACE VIEW invoice_payment_summary AS
SELECT 
    i.id as invoice_id,
    i.amount_cents as total_amount_cents,
    i.payment_plan_enabled,
    i.payment_plan_type,
    COUNT(pp.id) as total_installments,
    COUNT(CASE WHEN pp.status = 'paid' THEN 1 END) as paid_installments,
    COUNT(CASE WHEN pp.status = 'pending' THEN 1 END) as pending_installments,
    COUNT(CASE WHEN pp.status = 'overdue' THEN 1 END) as overdue_installments,
    COALESCE(SUM(CASE WHEN pp.status = 'paid' THEN pp.amount_cents ELSE 0 END), 0) as paid_amount_cents,
    COALESCE(SUM(CASE WHEN pp.status IN ('pending', 'overdue') THEN pp.amount_cents ELSE 0 END), 0) as remaining_amount_cents,
    MIN(CASE WHEN pp.status IN ('pending', 'overdue') THEN pp.due_date END) as next_due_date
FROM invoices i
LEFT JOIN invoice_payment_plans pp ON pp.invoice_id = i.id
GROUP BY i.id, i.amount_cents, i.payment_plan_enabled, i.payment_plan_type;