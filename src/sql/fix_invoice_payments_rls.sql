-- Fix RLS policies for invoice_payments table
-- The current policies are preventing inserts/updates to invoice_payments

-- Check current RLS status and policies
SELECT 
    schemaname, 
    tablename, 
    rowsecurity,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'invoice_payments'
ORDER BY tablename, policyname;

-- First, let's see what RLS policies exist for invoice_payments
\d+ invoice_payments

-- Drop any existing policies that might be blocking inserts
DROP POLICY IF EXISTS "Users can see invoice payments from their organizations" ON invoice_payments;
DROP POLICY IF EXISTS "Users can manage invoice payments from their organizations" ON invoice_payments;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON invoice_payments;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON invoice_payments;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON invoice_payments;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON invoice_payments;

-- Create comprehensive RLS policies for invoice_payments
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

-- Grant proper permissions to authenticated users
GRANT ALL ON invoice_payments TO authenticated;

-- Test the fix with a simple query
-- This should return payments for the authenticated user's organization
SELECT 
    ip.id,
    ip.invoice_id,
    ip.amount_cents,
    ip.paid_at,
    i.invoice_number,
    i.org_id
FROM invoice_payments ip
JOIN invoices i ON i.id = ip.invoice_id
LIMIT 5;

-- Verify the policies are working
SELECT 
    'Policy Test' as test_name,
    COUNT(*) as accessible_payments
FROM invoice_payments ip
WHERE ip.invoice_id IN (
    SELECT i.id FROM invoices i
    JOIN org_members om ON om.org_id = i.org_id
    WHERE om.user_id = auth.uid()
);