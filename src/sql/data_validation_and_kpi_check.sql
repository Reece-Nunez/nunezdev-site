-- =====================================
-- DATA VALIDATION & KPI VERIFICATION
-- =====================================
-- Run this after backfilling data to ensure everything is consistent

-- Step 1: Overall Database Health Check
SELECT 
    'Database Health Check' as report_section,
    'Current Totals' as metric_type,
    (SELECT COUNT(*) FROM clients) as total_clients,
    (SELECT COUNT(*) FROM deals) as total_deals,
    (SELECT COUNT(*) FROM invoices) as total_invoices,
    (SELECT COUNT(*) FROM invoice_payments) as total_payments;

-- Step 2: Financial KPIs Validation
SELECT 
    'Financial KPIs' as report_section,
    'Overall Totals' as metric_type,
    ROUND((SELECT SUM(amount_cents) FROM invoices WHERE status != 'draft')::numeric / 100, 2) as total_invoiced_dollars,
    ROUND((SELECT SUM(amount_cents) FROM invoice_payments)::numeric / 100, 2) as total_paid_dollars,
    ROUND((SELECT SUM(remaining_balance_cents) FROM invoices WHERE status IN ('sent', 'overdue', 'partially_paid'))::numeric / 100, 2) as total_outstanding_dollars;

-- Step 3: Client-Level Financial Summary (Top 10 by revenue)
SELECT 
    'Top Clients by Revenue' as report_section,
    c.name as client_name,
    c.email as client_email,
    c.status as client_status,
    ROUND(co.total_invoiced_cents::numeric / 100, 2) as total_invoiced_dollars,
    ROUND(co.total_paid_cents::numeric / 100, 2) as total_paid_dollars,
    ROUND(co.balance_due_cents::numeric / 100, 2) as balance_due_dollars,
    co.current_deal_stage,
    co.open_deals_count
FROM clients_overview co
JOIN clients c ON c.id = co.id
WHERE co.total_invoiced_cents > 0
ORDER BY co.total_invoiced_cents DESC
LIMIT 10;

-- Step 4: Invoice Status Distribution
SELECT 
    'Invoice Status Distribution' as report_section,
    status,
    COUNT(*) as count,
    ROUND(SUM(amount_cents)::numeric / 100, 2) as total_amount_dollars,
    ROUND(SUM(total_paid_cents)::numeric / 100, 2) as total_paid_dollars,
    ROUND(SUM(remaining_balance_cents)::numeric / 100, 2) as remaining_balance_dollars
FROM invoices
GROUP BY status
ORDER BY SUM(amount_cents) DESC;

-- Step 5: Payment Method Analysis
SELECT 
    'Payment Analysis' as report_section,
    payment_method,
    COUNT(*) as payment_count,
    ROUND(SUM(amount_cents)::numeric / 100, 2) as total_amount_dollars,
    ROUND(AVG(amount_cents)::numeric / 100, 2) as avg_payment_dollars,
    MIN(paid_at) as earliest_payment,
    MAX(paid_at) as latest_payment
FROM invoice_payments
GROUP BY payment_method
ORDER BY SUM(amount_cents) DESC;

-- Step 6: Data Consistency Checks
-- Check for invoices marked as paid but with no payments
SELECT 
    'Data Consistency Issues' as report_section,
    'Paid invoices without payment records' as issue_type,
    i.id as invoice_id,
    i.stripe_invoice_id,
    i.amount_cents,
    i.status,
    c.name as client_name
FROM invoices i
LEFT JOIN clients c ON c.id = i.client_id
LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
WHERE i.status = 'paid' 
    AND ip.id IS NULL;

-- Check for payment totals that don't match
SELECT 
    'Data Consistency Issues' as report_section,
    'Invoice totals vs payment sum mismatch' as issue_type,
    i.id as invoice_id,
    i.stripe_invoice_id,
    i.total_paid_cents as invoice_total_paid,
    COALESCE(SUM(ip.amount_cents), 0) as actual_payments_sum,
    ABS(i.total_paid_cents - COALESCE(SUM(ip.amount_cents), 0)) as difference_cents,
    c.name as client_name
FROM invoices i
LEFT JOIN clients c ON c.id = i.client_id
LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
GROUP BY i.id, i.stripe_invoice_id, i.total_paid_cents, c.name
HAVING ABS(i.total_paid_cents - COALESCE(SUM(ip.amount_cents), 0)) > 0
ORDER BY ABS(i.total_paid_cents - COALESCE(SUM(ip.amount_cents), 0)) DESC;

-- Step 7: Deal Pipeline Analysis
SELECT 
    'Deal Pipeline' as report_section,
    stage,
    COUNT(*) as deal_count,
    ROUND(SUM(value_cents)::numeric / 100, 2) as total_value_dollars,
    ROUND(AVG(value_cents)::numeric / 100, 2) as avg_deal_value_dollars,
    ROUND(AVG(probability), 1) as avg_probability
FROM deals
GROUP BY stage
ORDER BY 
    CASE stage
        WHEN 'New' THEN 1
        WHEN 'Discovery' THEN 2
        WHEN 'Proposal' THEN 3
        WHEN 'Negotiation' THEN 4
        WHEN 'Won' THEN 5
        WHEN 'Lost' THEN 6
        ELSE 7
    END;

-- Step 8: Monthly Revenue Trends (last 12 months)
SELECT 
    'Monthly Revenue Trends' as report_section,
    DATE_TRUNC('month', paid_at) as month,
    COUNT(*) as payments_count,
    ROUND(SUM(amount_cents)::numeric / 100, 2) as revenue_dollars
FROM invoice_payments
WHERE paid_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', paid_at)
ORDER BY month DESC;

-- Step 9: Outstanding Invoices Analysis
SELECT 
    'Outstanding Invoices' as report_section,
    CASE 
        WHEN due_at < NOW() - INTERVAL '60 days' THEN '60+ days overdue'
        WHEN due_at < NOW() - INTERVAL '30 days' THEN '30-60 days overdue'
        WHEN due_at < NOW() THEN '1-30 days overdue'
        WHEN due_at <= NOW() + INTERVAL '30 days' THEN 'Due within 30 days'
        ELSE 'Due later'
    END as aging_bucket,
    COUNT(*) as invoice_count,
    ROUND(SUM(remaining_balance_cents)::numeric / 100, 2) as total_outstanding_dollars
FROM invoices
WHERE status IN ('sent', 'overdue', 'partially_paid')
    AND remaining_balance_cents > 0
GROUP BY 
    CASE 
        WHEN due_at < NOW() - INTERVAL '60 days' THEN '60+ days overdue'
        WHEN due_at < NOW() - INTERVAL '30 days' THEN '30-60 days overdue'
        WHEN due_at < NOW() THEN '1-30 days overdue'
        WHEN due_at <= NOW() + INTERVAL '30 days' THEN 'Due within 30 days'
        ELSE 'Due later'
    END
ORDER BY 
    CASE 
        WHEN due_at < NOW() - INTERVAL '60 days' THEN 1
        WHEN due_at < NOW() - INTERVAL '30 days' THEN 2
        WHEN due_at < NOW() THEN 3
        WHEN due_at <= NOW() + INTERVAL '30 days' THEN 4
        ELSE 5
    END;

-- Step 10: Client Activity Summary
SELECT 
    'Client Activity' as report_section,
    c.status as client_status,
    COUNT(*) as client_count,
    COUNT(CASE WHEN ca.open_deals_count > 0 THEN 1 END) as clients_with_open_deals,
    COUNT(CASE WHEN ca.next_task_due_at IS NOT NULL THEN 1 END) as clients_with_upcoming_tasks,
    ROUND(AVG(EXTRACT(DAYS FROM NOW() - ca.last_activity_at)), 1) as avg_days_since_last_activity
FROM clients c
LEFT JOIN client_activity ca ON ca.client_id = c.id
GROUP BY c.status
ORDER BY client_count DESC;

-- Step 11: Quick Fix for Any Remaining Issues
-- Update any remaining balance calculations
UPDATE invoices 
SET remaining_balance_cents = GREATEST(amount_cents - total_paid_cents, 0)
WHERE remaining_balance_cents != GREATEST(amount_cents - total_paid_cents, 0);

-- Update invoice status based on payment totals
UPDATE invoices 
SET status = CASE 
    WHEN total_paid_cents >= amount_cents THEN 'paid'
    WHEN total_paid_cents > 0 AND total_paid_cents < amount_cents THEN 'partially_paid'
    WHEN status = 'paid' OR status = 'partially_paid' THEN 'sent'
    ELSE status
END,
paid_at = CASE 
    WHEN total_paid_cents >= amount_cents AND paid_at IS NULL THEN NOW()
    WHEN total_paid_cents < amount_cents THEN NULL
    ELSE paid_at
END
WHERE (
    (total_paid_cents >= amount_cents AND status != 'paid') OR
    (total_paid_cents > 0 AND total_paid_cents < amount_cents AND status != 'partially_paid') OR
    (total_paid_cents = 0 AND status IN ('paid', 'partially_paid'))
);

-- Step 12: Final Summary Report
SELECT 
    'Final Summary Report' as report_section,
    'Database is ready' as status,
    (SELECT COUNT(*) FROM clients) as total_clients,
    (SELECT COUNT(*) FROM deals) as total_deals,
    (SELECT COUNT(*) FROM invoices) as total_invoices,
    (SELECT COUNT(*) FROM invoice_payments) as total_payments,
    ROUND((SELECT SUM(amount_cents) FROM invoices WHERE status != 'draft')::numeric / 100, 2) as total_invoiced_dollars,
    ROUND((SELECT SUM(amount_cents) FROM invoice_payments)::numeric / 100, 2) as total_collected_dollars,
    ROUND((SELECT SUM(remaining_balance_cents) FROM invoices WHERE status IN ('sent', 'overdue', 'partially_paid'))::numeric / 100, 2) as total_outstanding_dollars;