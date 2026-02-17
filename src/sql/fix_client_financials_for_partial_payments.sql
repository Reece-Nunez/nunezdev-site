-- Update client_financials view to use the new partial payment system
-- This fixes the issue where clients show as fully paid when they've only made partial payments

CREATE OR REPLACE VIEW client_financials AS
SELECT
  c.id as client_id,
  -- Total invoiced: sum of all sent/paid/overdue/partially_paid invoices
  COALESCE(SUM(
    CASE WHEN i.status IN ('sent', 'paid', 'overdue', 'partially_paid') 
    THEN i.amount_cents 
    ELSE 0 END
  ), 0) as total_invoiced_cents,
  
  -- Total paid: sum of actual payments recorded in invoice_payments table
  -- Use the total_paid_cents column which is automatically maintained by triggers
  COALESCE(SUM(
    CASE WHEN i.status IN ('sent', 'paid', 'overdue', 'partially_paid')
    THEN COALESCE(i.total_paid_cents, 0)
    ELSE 0 END
  ), 0) as total_paid_cents,
  
  -- Balance due: sum of remaining balances
  -- Use the remaining_balance_cents column which is automatically maintained by triggers  
  COALESCE(SUM(
    CASE WHEN i.status IN ('sent', 'overdue', 'partially_paid')
    THEN COALESCE(i.remaining_balance_cents, i.amount_cents)
    ELSE 0 END
  ), 0) as balance_due_cents
FROM clients c
LEFT JOIN invoices i ON i.client_id = c.id
GROUP BY c.id;