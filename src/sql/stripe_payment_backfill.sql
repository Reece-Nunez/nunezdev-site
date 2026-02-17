-- =====================================
-- STRIPE PAYMENT BACKFILL SCRIPT
-- =====================================
-- This script helps you backfill missing Stripe payment data

-- Step 1: Check current state before backfill
SELECT 
    'Before Backfill' as status,
    COUNT(*) as total_invoices,
    SUM(amount_cents) as total_invoiced_cents,
    SUM(total_paid_cents) as total_paid_cents,
    SUM(remaining_balance_cents) as total_outstanding_cents
FROM invoices 
WHERE status != 'draft';

-- Step 2: Show invoices that might be missing payments
SELECT 
    'Invoices Missing Payments' as report_type,
    i.id,
    i.stripe_invoice_id,
    i.amount_cents,
    i.total_paid_cents,
    i.remaining_balance_cents,
    i.status,
    c.name as client_name,
    c.email as client_email
FROM invoices i
LEFT JOIN clients c ON c.id = i.client_id
WHERE i.status IN ('sent', 'overdue', 'partially_paid', 'paid')
    AND (i.total_paid_cents = 0 OR i.total_paid_cents < i.amount_cents)
ORDER BY i.created_at DESC;

-- Step 3: Create temporary table for Stripe data import
CREATE TEMP TABLE stripe_payments_import (
    stripe_charge_id text,
    created_date text,
    amount_dollars numeric,
    amount_refunded_dollars numeric,
    currency text,
    status text,
    customer_email text,
    invoice_id text,
    description text
);

-- Step 4: Sample INSERT for your Stripe data 
-- Replace this with actual data from your CSV
-- You'll need to convert the CSV data to INSERT statements

-- Example based on your Stripe data:
INSERT INTO stripe_payments_import VALUES 
('ch_3S5W4UI6Rruvv9u81BAl4N4H', '2025-09-09 18:15:15', 712.50, 0.00, 'usd', 'Paid', 'aaron.r@gogoldman.com', '', 'NUNEZ DEVELOPMENT');

-- Add more rows here for each Stripe payment...

-- Step 5: Match Stripe payments to existing invoices by email and amount
WITH matched_payments AS (
    SELECT 
        sp.stripe_charge_id,
        sp.created_date::timestamptz as paid_at,
        (sp.amount_dollars * 100)::integer as amount_cents,
        sp.customer_email,
        sp.description,
        i.id as invoice_id,
        i.amount_cents as invoice_amount_cents,
        c.name as client_name
    FROM stripe_payments_import sp
    LEFT JOIN clients c ON c.email = sp.customer_email
    LEFT JOIN invoices i ON i.client_id = c.id 
        AND ABS(i.amount_cents - (sp.amount_dollars * 100)::integer) < 100 -- Match within $1
    WHERE sp.status = 'Paid'
)
SELECT * FROM matched_payments;

-- Step 6: Insert matched payments into invoice_payments table
-- Run this after verifying the matches above look correct
INSERT INTO invoice_payments (
    invoice_id,
    stripe_charge_id,
    amount_cents,
    payment_method,
    paid_at,
    metadata
)
SELECT 
    mp.invoice_id,
    mp.stripe_charge_id,
    mp.amount_cents,
    'card', -- assuming card payments
    mp.paid_at,
    jsonb_build_object(
        'customer_email', mp.customer_email,
        'description', mp.description
    )
FROM (
    SELECT 
        sp.stripe_charge_id,
        sp.created_date::timestamptz as paid_at,
        (sp.amount_dollars * 100)::integer as amount_cents,
        sp.customer_email,
        sp.description,
        i.id as invoice_id
    FROM stripe_payments_import sp
    LEFT JOIN clients c ON c.email = sp.customer_email
    LEFT JOIN invoices i ON i.client_id = c.id 
        AND ABS(i.amount_cents - (sp.amount_dollars * 100)::integer) < 100
    WHERE sp.status = 'Paid' 
        AND i.id IS NOT NULL -- Only insert where we found a match
        AND NOT EXISTS (
            SELECT 1 FROM invoice_payments ip 
            WHERE ip.stripe_charge_id = sp.stripe_charge_id
        ) -- Don't insert duplicates
) mp;

-- Step 7: Handle unmatched payments (create new invoices if needed)
-- This creates invoices for payments that don't match existing invoices
INSERT INTO invoices (
    org_id,
    client_id,
    stripe_invoice_id,
    status,
    amount_cents,
    total_paid_cents,
    remaining_balance_cents,
    issued_at,
    paid_at
)
SELECT 
    c.org_id,
    c.id as client_id,
    'stripe_' || sp.stripe_charge_id as stripe_invoice_id,
    'paid' as status,
    (sp.amount_dollars * 100)::integer as amount_cents,
    (sp.amount_dollars * 100)::integer as total_paid_cents,
    0 as remaining_balance_cents,
    sp.created_date::timestamptz as issued_at,
    sp.created_date::timestamptz as paid_at
FROM stripe_payments_import sp
LEFT JOIN clients c ON c.email = sp.customer_email
LEFT JOIN invoices i ON i.client_id = c.id 
    AND ABS(i.amount_cents - (sp.amount_dollars * 100)::integer) < 100
WHERE sp.status = 'Paid' 
    AND c.id IS NOT NULL -- Client exists
    AND i.id IS NULL -- No matching invoice found
    AND NOT EXISTS (
        SELECT 1 FROM invoices inv 
        WHERE inv.stripe_invoice_id = 'stripe_' || sp.stripe_charge_id
    ); -- Don't create duplicates

-- Step 8: Create corresponding payment records for new invoices
INSERT INTO invoice_payments (
    invoice_id,
    stripe_charge_id,
    amount_cents,
    payment_method,
    paid_at,
    metadata
)
SELECT 
    i.id as invoice_id,
    sp.stripe_charge_id,
    (sp.amount_dollars * 100)::integer as amount_cents,
    'card',
    sp.created_date::timestamptz,
    jsonb_build_object(
        'customer_email', sp.customer_email,
        'description', sp.description,
        'auto_created', true
    )
FROM stripe_payments_import sp
LEFT JOIN clients c ON c.email = sp.customer_email
JOIN invoices i ON i.stripe_invoice_id = 'stripe_' || sp.stripe_charge_id
WHERE sp.status = 'Paid' 
    AND c.id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM invoice_payments ip 
        WHERE ip.stripe_charge_id = sp.stripe_charge_id
    );

-- Step 9: Final validation and summary
SELECT 
    'After Backfill' as status,
    COUNT(*) as total_invoices,
    SUM(amount_cents) as total_invoiced_cents,
    SUM(total_paid_cents) as total_paid_cents,
    SUM(remaining_balance_cents) as total_outstanding_cents
FROM invoices 
WHERE status != 'draft';

-- Show payment summary
SELECT 
    'Payment Summary' as report_type,
    COUNT(*) as total_payments,
    SUM(amount_cents) as total_payment_amount_cents,
    MIN(paid_at) as earliest_payment,
    MAX(paid_at) as latest_payment
FROM invoice_payments;

-- Show any remaining unmatched Stripe payments
SELECT 
    'Unmatched Stripe Payments' as report_type,
    sp.stripe_charge_id,
    sp.amount_dollars,
    sp.customer_email,
    sp.description,
    CASE 
        WHEN c.id IS NULL THEN 'No client found'
        ELSE 'Client exists but no matching invoice'
    END as issue
FROM stripe_payments_import sp
LEFT JOIN clients c ON c.email = sp.customer_email
LEFT JOIN invoices i ON i.client_id = c.id 
    AND ABS(i.amount_cents - (sp.amount_dollars * 100)::integer) < 100
WHERE sp.status = 'Paid' 
    AND i.id IS NULL;

-- Clean up temp table
DROP TABLE stripe_payments_import;