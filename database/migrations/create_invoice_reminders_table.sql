-- Create table to track sent invoice reminders
CREATE TABLE IF NOT EXISTS invoice_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recurring_invoice_id UUID NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
    reminder_date DATE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate reminders for same invoice on same date
    UNIQUE(recurring_invoice_id, reminder_date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_recurring_invoice_id ON invoice_reminders(recurring_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_reminder_date ON invoice_reminders(reminder_date);

-- Add RLS policy
ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see reminders for their org's invoices
CREATE POLICY "Users can view invoice reminders for their org" ON invoice_reminders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM recurring_invoices ri
            WHERE ri.id = invoice_reminders.recurring_invoice_id
            AND ri.org_id = auth.jwt() ->> 'org_id'
        )
    );