-- Fix duplicate payments and RLS issues
-- Run this in your Supabase SQL editor

-- 1. First, let's see the duplicate payments
SELECT 
    stripe_payment_intent_id,
    invoice_id,
    COUNT(*) as payment_count,
    STRING_AGG(id::text, ', ') as payment_ids
FROM invoice_payments 
WHERE stripe_payment_intent_id = 'pi_3Rsr7rI6Rruvv9u80GwrpNjc'
GROUP BY stripe_payment_intent_id, invoice_id
HAVING COUNT(*) > 1;

-- 2. Remove duplicate payments (keep the first one created)
DELETE FROM invoice_payments 
WHERE id IN (
    SELECT id 
    FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY stripe_payment_intent_id, invoice_id 
                   ORDER BY created_at ASC
               ) as rn
        FROM invoice_payments 
        WHERE stripe_payment_intent_id = 'pi_3Rsr7rI6Rruvv9u80GwrpNjc'
    ) t 
    WHERE rn > 1
);

-- 3. Check current RLS policies on invoice_payments
SELECT 
    schemaname, 
    tablename, 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'invoice_payments'
ORDER BY policyname;

-- 4. Ensure proper RLS policies exist for reads
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can see invoice payments from their organizations" ON invoice_payments;
DROP POLICY IF EXISTS "Users can insert invoice payments for their organizations" ON invoice_payments;
DROP POLICY IF EXISTS "Users can update invoice payments for their organizations" ON invoice_payments;
DROP POLICY IF EXISTS "Users can delete invoice payments for their organizations" ON invoice_payments;

-- Create comprehensive RLS policies
-- Allow users to see payments for invoices from their organizations
CREATE POLICY "Users can see invoice payments from their organizations" ON invoice_payments
    FOR SELECT USING (
        invoice_id IN (
            SELECT i.id FROM invoices i
            JOIN org_members om ON om.org_id = i.org_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Allow users to insert payments for invoices from their organizations
CREATE POLICY "Users can insert invoice payments for their organizations" ON invoice_payments
    FOR INSERT WITH CHECK (
        invoice_id IN (
            SELECT i.id FROM invoices i
            JOIN org_members om ON om.org_id = i.org_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Allow users to update payments for invoices from their organizations
CREATE POLICY "Users can update invoice payments for their organizations" ON invoice_payments
    FOR UPDATE USING (
        invoice_id IN (
            SELECT i.id FROM invoices i
            JOIN org_members om ON om.org_id = i.org_id
            WHERE om.user_id = auth.uid()
        )
    ) WITH CHECK (
        invoice_id IN (
            SELECT i.id FROM invoices i
            JOIN org_members om ON om.org_id = i.org_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Allow users to delete payments for invoices from their organizations
CREATE POLICY "Users can delete invoice payments for their organizations" ON invoice_payments
    FOR DELETE USING (
        invoice_id IN (
            SELECT i.id FROM invoices i
            JOIN org_members om ON om.org_id = i.org_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Ensure RLS is enabled
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- Grant proper permissions
GRANT ALL ON invoice_payments TO authenticated;

-- 5. Test query to verify payments are visible
-- This should return the remaining payment after cleanup
SELECT 
    ip.id,
    ip.invoice_id,
    ip.stripe_payment_intent_id,
    ip.amount_cents,
    ip.paid_at,
    i.invoice_number,
    i.org_id,
    c.name as client_name
FROM invoice_payments ip
JOIN invoices i ON i.id = ip.invoice_id
JOIN clients c ON c.id = i.client_id
WHERE ip.stripe_payment_intent_id = 'pi_3Rsr7rI6Rruvv9u80GwrpNjc';

-- 6. Check if invoice totals are correct after cleanup
SELECT 
    i.id,
    i.invoice_number,
    i.amount_cents as invoice_amount,
    i.total_paid_cents,
    i.remaining_balance_cents,
    i.status,
    (SELECT COUNT(*) FROM invoice_payments ip WHERE ip.invoice_id = i.id) as payment_count,
    (SELECT SUM(ip.amount_cents) FROM invoice_payments ip WHERE ip.invoice_id = i.id) as calculated_paid
FROM invoices i 
WHERE i.stripe_payment_intent_id = 'pi_3Rsr7rI6Rruvv9u80GwrpNjc';