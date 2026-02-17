-- Create a function to sync all invoice payment totals
CREATE OR REPLACE FUNCTION sync_invoice_payment_totals()
RETURNS void AS $$
BEGIN
    -- Update invoices with payment totals
    UPDATE invoices 
    SET 
        total_paid_cents = COALESCE(payment_totals.total_paid, 0),
        remaining_balance_cents = GREATEST(amount_cents - COALESCE(payment_totals.total_paid, 0), 0),
        status = CASE 
            WHEN COALESCE(payment_totals.total_paid, 0) = 0 THEN 
                CASE WHEN status IN ('paid', 'partially_paid') THEN 'sent' ELSE status END
            WHEN COALESCE(payment_totals.total_paid, 0) >= amount_cents THEN 'paid'
            WHEN COALESCE(payment_totals.total_paid, 0) > 0 AND COALESCE(payment_totals.total_paid, 0) < amount_cents THEN 'partially_paid'
            ELSE status
        END,
        paid_at = CASE 
            WHEN COALESCE(payment_totals.total_paid, 0) >= amount_cents THEN COALESCE(paid_at, now())
            ELSE NULL
        END
    FROM (
        SELECT 
            invoice_id,
            SUM(amount_cents) as total_paid
        FROM invoice_payments 
        GROUP BY invoice_id
    ) as payment_totals
    WHERE invoices.id = payment_totals.invoice_id;

    -- Update invoices that have no payments to ensure they have correct defaults
    UPDATE invoices 
    SET 
        total_paid_cents = 0,
        remaining_balance_cents = amount_cents
    WHERE id NOT IN (
        SELECT DISTINCT invoice_id FROM invoice_payments
    ) AND (total_paid_cents IS NULL OR total_paid_cents != 0);
    
END;
$$ LANGUAGE plpgsql;