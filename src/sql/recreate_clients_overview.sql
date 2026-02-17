-- Drop existing views in dependency order
DROP VIEW IF EXISTS clients_overview;
DROP VIEW IF EXISTS client_activity; 
DROP VIEW IF EXISTS client_financials;
DROP VIEW IF EXISTS client_deal_current;

-- Latest 'active' deal per client (prefers non-Won/Lost; fallback: newest)
CREATE OR REPLACE VIEW client_deal_current AS
WITH ranked AS (
  SELECT
    d.*,
    ROW_NUMBER() OVER (
      PARTITION BY d.client_id
      ORDER BY (CASE WHEN d.stage IN ('Won','Lost') THEN 1 ELSE 0 END), d.created_at DESC
    ) AS rnk
  FROM deals d
)
SELECT * FROM ranked WHERE rnk = 1;

-- Financials per client
CREATE OR REPLACE VIEW client_financials AS
SELECT
  c.id AS client_id,
  COALESCE(SUM(CASE WHEN i.status IN ('sent','paid','overdue','partially_paid') THEN i.amount_cents ELSE 0 END), 0)::bigint AS total_invoiced_cents,
  COALESCE(SUM(COALESCE(p.total_payments::bigint, 0)), 0)::bigint AS total_paid_cents,
  (COALESCE(SUM(CASE WHEN i.status IN ('sent','overdue','partially_paid') THEN i.amount_cents ELSE 0 END), 0)
    - COALESCE(SUM(COALESCE(p.total_payments::bigint, 0)), 0))::bigint AS balance_due_cents,
  COALESCE(SUM(CASE WHEN i.status = 'draft' THEN i.amount_cents ELSE 0 END), 0)::bigint AS draft_invoiced_cents
FROM clients c
LEFT JOIN invoices i ON i.client_id = c.id
LEFT JOIN (
  SELECT 
    ip.invoice_id,
    SUM(ip.amount_cents)::bigint AS total_payments
  FROM invoice_payments ip
  GROUP BY ip.invoice_id
) p ON p.invoice_id = i.id
GROUP BY c.id;

-- Activity + extras per client
CREATE OR REPLACE VIEW client_activity AS
SELECT
  c.id AS client_id,
  GREATEST(
    COALESCE((SELECT MAX(d.created_at) FROM deals d WHERE d.client_id = c.id), TO_TIMESTAMP(0)),
    COALESCE((SELECT MAX(n.created_at) FROM notes n WHERE n.relates_to='client' AND n.relates_id = c.id), TO_TIMESTAMP(0)),
    COALESCE((SELECT MAX(i.issued_at) FROM invoices i WHERE i.client_id = c.id), TO_TIMESTAMP(0)),
    COALESCE((SELECT MAX(t.created_at) FROM tasks t WHERE t.relates_to='client' AND t.relates_id = c.id), TO_TIMESTAMP(0))
  ) AS last_activity_at,
  COALESCE((
    SELECT COUNT(*) FROM deals d
    WHERE d.client_id = c.id AND d.stage NOT IN ('Won','Lost')
  ), 0) AS open_deals_count,
  (
    SELECT MIN(t.due_at) FROM tasks t
    WHERE t.relates_to='client' AND t.relates_id = c.id AND COALESCE(t.done, FALSE) = FALSE AND t.due_at IS NOT NULL
  ) AS next_task_due_at
FROM clients c;

-- Final overview
CREATE OR REPLACE VIEW clients_overview AS
SELECT
  c.id,
  c.org_id,
  c.name,
  c.email,
  c.phone,
  c.company,
  c.status,
  c.tags,
  c.created_at,
  COALESCE(cf.total_invoiced_cents, 0) AS total_invoiced_cents,
  COALESCE(cf.total_paid_cents, 0) AS total_paid_cents,
  COALESCE(cf.balance_due_cents, 0) AS balance_due_cents,
  COALESCE(cf.draft_invoiced_cents, 0) AS draft_invoiced_cents,
  cdc.stage AS current_stage,
  ca.last_activity_at,
  ca.open_deals_count,
  ca.next_task_due_at
FROM clients c
LEFT JOIN client_financials cf ON cf.client_id = c.id
LEFT JOIN client_deal_current cdc ON cdc.client_id = c.id
LEFT JOIN client_activity ca ON ca.client_id = c.id;