-- =====================================
-- HUBSPOT INVOICE BACKFILL SCRIPT
-- =====================================
-- This script helps you import invoice data from HubSpot

-- Step 1: Create temporary table for HubSpot invoice data
CREATE TEMP TABLE hubspot_invoices_import (
    hubspot_deal_id text,
    deal_name text,
    deal_amount numeric,
    deal_stage text,
    deal_close_date text,
    contact_email text,
    contact_name text,
    company_name text,
    invoice_number text,
    invoice_amount numeric,
    invoice_status text,
    invoice_date text,
    payment_date text
);

-- Step 2: Sample data structure - replace with your actual HubSpot data
-- You'll need to export this data from HubSpot and convert to INSERT statements
-- INSERT INTO hubspot_invoices_import VALUES 
-- ('deal_123', 'Website Development', 5000.00, 'Closed Won', '2025-01-15', 'client@example.com', 'John Smith', 'Example Corp', 'INV-001', 5000.00, 'Paid', '2025-01-15', '2025-01-20');

-- Step 3: Find or create clients from HubSpot data
-- This will help you map HubSpot contacts to Supabase clients
WITH hubspot_contacts AS (
    SELECT DISTINCT
        contact_email,
        contact_name,
        company_name
    FROM hubspot_invoices_import
    WHERE contact_email IS NOT NULL
)
SELECT 
    hc.contact_email,
    hc.contact_name,
    hc.company_name,
    c.id as existing_client_id,
    CASE 
        WHEN c.id IS NULL THEN 'NEEDS_CREATION'
        ELSE 'EXISTS'
    END as client_status
FROM hubspot_contacts hc
LEFT JOIN clients c ON c.email = hc.contact_email
ORDER BY client_status, hc.contact_email;

-- Step 4: Create missing clients from HubSpot data
-- Replace 'your-org-id-here' with your actual organization ID
INSERT INTO clients (
    org_id,
    name,
    email,
    company,
    status,
    created_at
)
SELECT 
    'your-org-id-here'::uuid as org_id, -- REPLACE WITH YOUR ORG ID
    hi.contact_name as name,
    hi.contact_email as email,
    hi.company_name as company,
    CASE 
        WHEN hi.deal_stage = 'Closed Won' THEN 'Active'
        WHEN hi.deal_stage = 'Closed Lost' THEN 'Past'
        ELSE 'Prospect'
    END as status,
    COALESCE(hi.deal_close_date::timestamptz, now()) as created_at
FROM (
    SELECT DISTINCT
        contact_email,
        contact_name,
        company_name,
        deal_stage,
        deal_close_date
    FROM hubspot_invoices_import
    WHERE contact_email IS NOT NULL
) hi
LEFT JOIN clients c ON c.email = hi.contact_email
WHERE c.id IS NULL; -- Only create if doesn't exist

-- Step 5: Create deals from HubSpot data
INSERT INTO deals (
    org_id,
    client_id,
    title,
    stage,
    value_cents,
    probability,
    expected_close_date,
    created_at
)
SELECT 
    'your-org-id-here'::uuid as org_id, -- REPLACE WITH YOUR ORG ID
    c.id as client_id,
    hi.deal_name as title,
    CASE 
        WHEN hi.deal_stage = 'Closed Won' THEN 'Won'
        WHEN hi.deal_stage = 'Closed Lost' THEN 'Lost'
        WHEN hi.deal_stage ILIKE '%proposal%' THEN 'Proposal'
        WHEN hi.deal_stage ILIKE '%negotiation%' THEN 'Negotiation'
        WHEN hi.deal_stage ILIKE '%discovery%' THEN 'Discovery'
        ELSE 'New'
    END as stage,
    (hi.deal_amount * 100)::integer as value_cents,
    CASE 
        WHEN hi.deal_stage = 'Closed Won' THEN 100
        WHEN hi.deal_stage = 'Closed Lost' THEN 0
        ELSE 50
    END as probability,
    COALESCE(hi.deal_close_date::date, current_date + interval '30 days') as expected_close_date,
    COALESCE(hi.deal_close_date::timestamptz, now()) as created_at
FROM (
    SELECT DISTINCT
        hubspot_deal_id,
        contact_email,
        deal_name,
        deal_amount,
        deal_stage,
        deal_close_date
    FROM hubspot_invoices_import
    WHERE hubspot_deal_id IS NOT NULL
) hi
JOIN clients c ON c.email = hi.contact_email
WHERE NOT EXISTS (
    SELECT 1 FROM deals d 
    WHERE d.client_id = c.id 
    AND d.title = hi.deal_name
); -- Avoid duplicates

-- Step 6: Create invoices from HubSpot data
INSERT INTO invoices (
    org_id,
    client_id,
    stripe_invoice_id,
    status,
    amount_cents,
    total_paid_cents,
    remaining_balance_cents,
    issued_at,
    due_at,
    paid_at
)
SELECT 
    'your-org-id-here'::uuid as org_id, -- REPLACE WITH YOUR ORG ID
    c.id as client_id,
    COALESCE(hi.invoice_number, 'hs_' || hi.hubspot_deal_id) as stripe_invoice_id,
    CASE 
        WHEN hi.invoice_status ILIKE '%paid%' OR hi.payment_date IS NOT NULL THEN 'paid'
        WHEN hi.invoice_status ILIKE '%sent%' OR hi.invoice_status ILIKE '%pending%' THEN 'sent'
        WHEN hi.invoice_status ILIKE '%draft%' THEN 'draft'
        WHEN hi.invoice_status ILIKE '%overdue%' THEN 'overdue'
        ELSE 'sent'
    END as status,
    (hi.invoice_amount * 100)::integer as amount_cents,
    CASE 
        WHEN hi.invoice_status ILIKE '%paid%' OR hi.payment_date IS NOT NULL 
        THEN (hi.invoice_amount * 100)::integer
        ELSE 0
    END as total_paid_cents,
    CASE 
        WHEN hi.invoice_status ILIKE '%paid%' OR hi.payment_date IS NOT NULL 
        THEN 0
        ELSE (hi.invoice_amount * 100)::integer
    END as remaining_balance_cents,
    COALESCE(hi.invoice_date::timestamptz, hi.deal_close_date::timestamptz, now()) as issued_at,
    COALESCE(hi.invoice_date::timestamptz, hi.deal_close_date::timestamptz, now()) + interval '30 days' as due_at,
    CASE 
        WHEN hi.payment_date IS NOT NULL THEN hi.payment_date::timestamptz
        ELSE NULL
    END as paid_at
FROM hubspot_invoices_import hi
JOIN clients c ON c.email = hi.contact_email
WHERE hi.invoice_amount > 0
    AND NOT EXISTS (
        SELECT 1 FROM invoices i 
        WHERE i.client_id = c.id 
        AND i.stripe_invoice_id = COALESCE(hi.invoice_number, 'hs_' || hi.hubspot_deal_id)
    ); -- Avoid duplicates

-- Step 7: Create payment records for paid HubSpot invoices
INSERT INTO invoice_payments (
    invoice_id,
    stripe_payment_intent_id,
    amount_cents,
    payment_method,
    paid_at,
    metadata
)
SELECT 
    i.id as invoice_id,
    'hs_payment_' || hi.hubspot_deal_id as stripe_payment_intent_id,
    (hi.invoice_amount * 100)::integer as amount_cents,
    'hubspot_import' as payment_method,
    COALESCE(hi.payment_date::timestamptz, hi.deal_close_date::timestamptz) as paid_at,
    jsonb_build_object(
        'source', 'hubspot',
        'deal_id', hi.hubspot_deal_id,
        'deal_name', hi.deal_name,
        'imported_at', now()
    ) as metadata
FROM hubspot_invoices_import hi
JOIN clients c ON c.email = hi.contact_email
JOIN invoices i ON i.client_id = c.id 
    AND i.stripe_invoice_id = COALESCE(hi.invoice_number, 'hs_' || hi.hubspot_deal_id)
WHERE (hi.invoice_status ILIKE '%paid%' OR hi.payment_date IS NOT NULL)
    AND hi.invoice_amount > 0
    AND NOT EXISTS (
        SELECT 1 FROM invoice_payments ip 
        WHERE ip.invoice_id = i.id
        AND ip.stripe_payment_intent_id = 'hs_payment_' || hi.hubspot_deal_id
    ); -- Avoid duplicates

-- Step 8: Show import summary
SELECT 
    'HubSpot Import Summary' as report_type,
    (SELECT COUNT(DISTINCT contact_email) FROM hubspot_invoices_import) as unique_contacts_in_import,
    (SELECT COUNT(*) FROM clients WHERE created_at > now() - interval '1 hour') as new_clients_created,
    (SELECT COUNT(*) FROM deals WHERE created_at > now() - interval '1 hour') as new_deals_created,
    (SELECT COUNT(*) FROM invoices WHERE created_at > now() - interval '1 hour') as new_invoices_created,
    (SELECT COUNT(*) FROM invoice_payments WHERE created_at > now() - interval '1 hour') as new_payments_created;

-- Step 9: Validate data consistency after import
SELECT 
    'Post-Import Validation' as report_type,
    (SELECT COUNT(*) FROM clients) as total_clients,
    (SELECT COUNT(*) FROM deals) as total_deals,
    (SELECT COUNT(*) FROM invoices) as total_invoices,
    (SELECT COUNT(*) FROM invoice_payments) as total_payments,
    (SELECT SUM(amount_cents) FROM invoices WHERE status != 'draft') as total_invoiced_cents,
    (SELECT SUM(amount_cents) FROM invoice_payments) as total_paid_cents;

-- Step 10: Show any potential issues
SELECT 
    'Potential Issues' as report_type,
    'Invoices without payments' as issue_type,
    COUNT(*) as count
FROM invoices 
WHERE status = 'paid' AND total_paid_cents = 0

UNION ALL

SELECT 
    'Potential Issues' as report_type,
    'Payments without matching invoice amount' as issue_type,
    COUNT(*) as count
FROM invoices i
JOIN invoice_payments ip ON ip.invoice_id = i.id
WHERE i.total_paid_cents != ip.amount_cents

UNION ALL

SELECT 
    'Potential Issues' as report_type,
    'Clients without deals' as issue_type,
    COUNT(*) as count
FROM clients c
LEFT JOIN deals d ON d.client_id = c.id
WHERE d.id IS NULL;

-- Clean up temp table
DROP TABLE hubspot_invoices_import;