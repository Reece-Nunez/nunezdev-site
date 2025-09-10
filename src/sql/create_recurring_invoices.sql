-- ======================================================
-- Recurring Invoices System (using organizations + org_members)
-- ======================================================

-- Create recurring_invoices table
CREATE TABLE IF NOT EXISTS recurring_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    -- Invoice template data
    title TEXT NOT NULL DEFAULT 'Monthly Hosting & Maintenance',
    description TEXT,
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Pricing
    amount_cents INTEGER NOT NULL,
    discount_type TEXT CHECK (discount_type IN ('percentage','fixed')),
    discount_value NUMERIC(10,2),

    -- Recurring settings
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','quarterly','annually')),
    start_date DATE NOT NULL,
    end_date DATE, -- NULL means recurring indefinitely
    next_invoice_date DATE NOT NULL,
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31), -- For monthly: which day to send

    -- Status and tracking
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','completed')),
    total_invoices_sent INTEGER DEFAULT 0,
    last_invoice_sent_at TIMESTAMP WITH TIME ZONE,
    last_invoice_id UUID REFERENCES invoices(id),

    -- Metadata
    payment_terms INTEGER DEFAULT 30,
    require_signature BOOLEAN DEFAULT false,
    send_reminder BOOLEAN DEFAULT true,
    reminder_days_before INTEGER DEFAULT 3,

    -- Branding
    brand_logo_url TEXT,
    brand_primary TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ======================================================
-- Indexes
-- ======================================================
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_org_id ON recurring_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_client_id ON recurring_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next_date ON recurring_invoices(next_invoice_date);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_status ON recurring_invoices(status);

-- ======================================================
-- Enable RLS
-- ======================================================
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;

-- ======================================================
-- RLS Policies
-- ======================================================
CREATE POLICY "Users can see recurring invoices from their organizations" ON recurring_invoices
    FOR SELECT USING (
        org_id IN (
            SELECT om.org_id FROM org_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert recurring invoices for their organizations" ON recurring_invoices
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT om.org_id FROM org_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update recurring invoices for their organizations" ON recurring_invoices
    FOR UPDATE USING (
        org_id IN (
            SELECT om.org_id FROM org_members om
            WHERE om.user_id = auth.uid()
        )
    ) WITH CHECK (
        org_id IN (
            SELECT om.org_id FROM org_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete recurring invoices for their organizations" ON recurring_invoices
    FOR DELETE USING (
        org_id IN (
            SELECT om.org_id FROM org_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_invoices TO authenticated;

-- ======================================================
-- Functions
-- ======================================================

-- Function: calculate next invoice date
CREATE OR REPLACE FUNCTION calculate_next_invoice_date(
    p_base_date DATE,
    p_frequency TEXT,
    p_day_of_month INTEGER DEFAULT NULL
) RETURNS DATE AS $$
DECLARE
    next_month DATE;
    target_date DATE;
BEGIN
    IF p_frequency = 'weekly' THEN
        RETURN (p_base_date + INTERVAL '1 week')::date;
    ELSIF p_frequency = 'monthly' THEN
        IF p_day_of_month IS NOT NULL THEN
            next_month := (date_trunc('month', p_base_date)::date + INTERVAL '1 month')::date;
            target_date := next_month + (p_day_of_month - 1);

            -- Clamp to last day of month if overflow (e.g., Feb 31 → Feb 28)
            IF EXTRACT(MONTH FROM target_date) != EXTRACT(MONTH FROM next_month) THEN
                target_date := (date_trunc('month', next_month)::date + INTERVAL '1 month' - INTERVAL '1 day')::date;
            END IF;

            RETURN target_date;
        ELSE
            RETURN (p_base_date + INTERVAL '1 month')::date;
        END IF;
    ELSIF p_frequency = 'quarterly' THEN
        RETURN (p_base_date + INTERVAL '3 months')::date;
    ELSIF p_frequency = 'annually' THEN
        RETURN (p_base_date + INTERVAL '1 year')::date;
    ELSE
        RETURN (p_base_date + INTERVAL '1 month')::date;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: update recurring invoice after invoice is sent
CREATE OR REPLACE FUNCTION update_recurring_invoice_after_send()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE recurring_invoices
    SET 
        next_invoice_date = calculate_next_invoice_date(
            next_invoice_date, 
            frequency, 
            day_of_month
        ),
        total_invoices_sent = COALESCE(total_invoices_sent, 0) + 1,
        last_invoice_sent_at = NOW(),
        last_invoice_id = NEW.id,
        updated_at = NOW()
    WHERE id = NEW.recurring_invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================================================
-- Add recurring_invoice_id column to invoices
-- ======================================================
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS recurring_invoice_id UUID REFERENCES recurring_invoices(id);

-- ======================================================
-- Triggers
-- ======================================================
DROP TRIGGER IF EXISTS trg_update_recurring_invoice_after_send ON invoices;

CREATE TRIGGER trg_update_recurring_invoice_after_send
AFTER INSERT ON invoices
FOR EACH ROW
WHEN (NEW.recurring_invoice_id IS NOT NULL)
EXECUTE FUNCTION update_recurring_invoice_after_send();

-- ======================================================
-- Views
-- ======================================================
CREATE OR REPLACE VIEW recurring_invoices_with_clients AS
SELECT 
    ri.*,
    c.name as client_name,
    c.email as client_email,
    c.company as client_company,
    c.phone as client_phone
FROM recurring_invoices ri
JOIN clients c ON c.id = ri.client_id;

-- ======================================================
-- Utility function: get recurring invoices due
-- ======================================================
CREATE OR REPLACE FUNCTION get_recurring_invoices_due_for_processing()
RETURNS TABLE (
    id UUID,
    org_id UUID,
    client_id UUID,
    title TEXT,
    description TEXT,
    line_items JSONB,
    amount_cents INTEGER,
    frequency TEXT,
    next_invoice_date DATE,
    client_name TEXT,
    client_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ri.id,
        ri.org_id,
        ri.client_id,
        ri.title,
        ri.description,
        ri.line_items,
        ri.amount_cents,
        ri.frequency,
        ri.next_invoice_date,
        c.name as client_name,
        c.email as client_email
    FROM recurring_invoices ri
    JOIN clients c ON c.id = ri.client_id
    WHERE ri.status = 'active'
      AND ri.next_invoice_date <= CURRENT_DATE
      AND (ri.end_date IS NULL OR ri.end_date >= CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- ======================================================
-- Documentation
-- ======================================================
COMMENT ON TABLE recurring_invoices IS 'Stores recurring invoice templates that automatically generate invoices on a schedule';
COMMENT ON FUNCTION get_recurring_invoices_due_for_processing() IS 'Returns all active recurring invoices that are due to have their next invoice generated';
COMMENT ON FUNCTION calculate_next_invoice_date(DATE, TEXT, INTEGER) IS 'Calculates the next invoice date based on frequency and day of month preferences';
