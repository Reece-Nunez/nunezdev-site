-- Extend invoices table for partial payments and better tracking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signer_name text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signer_email text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signer_ip text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signature_svg text;

-- Payment tracking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_paid_cents integer DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS remaining_balance_cents integer;

-- Update status enum to include partial payment states
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
    CHECK (status IN ('draft','sent','paid','void','overdue','partially_paid'));

-- Create payments table to track individual Stripe transactions
CREATE TABLE IF NOT EXISTS invoice_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    stripe_payment_intent_id text,
    stripe_charge_id text,
    amount_cents integer NOT NULL,
    payment_method text,
    paid_at timestamptz NOT NULL,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_stripe_payment_intent_id ON invoice_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_stripe_charge_id ON invoice_payments(stripe_charge_id);

-- Create trigger for invoice_payments updated_at
CREATE OR REPLACE FUNCTION update_invoice_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_invoice_payments_updated_at_trigger ON invoice_payments;
CREATE TRIGGER update_invoice_payments_updated_at_trigger
    BEFORE UPDATE ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_payments_updated_at();

-- Function to update invoice payment status when payments are added/removed
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate total payments for the invoice
    WITH payment_totals AS (
        SELECT 
            invoice_id,
            COALESCE(SUM(amount_cents), 0) as total_paid
        FROM invoice_payments 
        WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        GROUP BY invoice_id
    )
    UPDATE invoices 
    SET 
        total_paid_cents = pt.total_paid,
        remaining_balance_cents = GREATEST(amount_cents - pt.total_paid, 0),
        status = CASE 
            WHEN pt.total_paid = 0 THEN 
                CASE WHEN status = 'paid' OR status = 'partially_paid' THEN 'sent' ELSE status END
            WHEN pt.total_paid >= amount_cents THEN 'paid'
            WHEN pt.total_paid > 0 AND pt.total_paid < amount_cents THEN 'partially_paid'
            ELSE status
        END,
        paid_at = CASE 
            WHEN pt.total_paid >= amount_cents THEN COALESCE(paid_at, now())
            ELSE NULL
        END
    FROM payment_totals pt
    WHERE invoices.id = pt.invoice_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Create triggers for payment status updates
DROP TRIGGER IF EXISTS update_invoice_payment_status_insert ON invoice_payments;
CREATE TRIGGER update_invoice_payment_status_insert
    AFTER INSERT ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_payment_status();

DROP TRIGGER IF EXISTS update_invoice_payment_status_update ON invoice_payments;
CREATE TRIGGER update_invoice_payment_status_update
    AFTER UPDATE ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_payment_status();

DROP TRIGGER IF EXISTS update_invoice_payment_status_delete ON invoice_payments;
CREATE TRIGGER update_invoice_payment_status_delete
    AFTER DELETE ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_payment_status();