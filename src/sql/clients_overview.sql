-- Latest 'active' deal per client (prefers non-Won/Lost; fallback: newest)
create or replace view client_deal_current as
with ranked as (
  select
    d.*,
    row_number() over (
      partition by d.client_id
      order by (case when d.stage in ('Won','Lost') then 1 else 0 end), d.created_at desc
    ) as rnk
  from deals d
)
select * from ranked where rnk = 1;

-- Financials per client
create or replace view client_financials as
select
  c.id as client_id,
  coalesce(sum(case when i.status in ('sent','paid','overdue','partially_paid') then i.amount_cents else 0 end), 0) as total_invoiced_cents,
  coalesce(sum(coalesce(p.total_payments, 0)), 0) as total_paid_cents,
  coalesce(sum(case when i.status in ('sent','overdue','partially_paid') then i.amount_cents else 0 end), 0)
    - coalesce(sum(coalesce(p.total_payments, 0)), 0) as balance_due_cents,
  coalesce(sum(case when i.status = 'draft' then i.amount_cents else 0 end), 0) as draft_invoiced_cents
from clients c
left join invoices i on i.client_id = c.id
left join (
  select 
    ip.invoice_id,
    sum(ip.amount_cents) as total_payments
  from invoice_payments ip
  group by ip.invoice_id
) p on p.invoice_id = i.id
group by c.id;

-- Activity + extras per client
create or replace view client_activity as
select
  c.id as client_id,
  greatest(
    coalesce((select max(d.created_at) from deals d where d.client_id = c.id), to_timestamp(0)),
    coalesce((select max(n.created_at) from notes n where n.relates_to='client' and n.relates_id = c.id), to_timestamp(0)),
    coalesce((select max(i.issued_at) from invoices i where i.client_id = c.id), to_timestamp(0)),
    coalesce((select max(t.created_at) from tasks t where t.relates_to='client' and t.relates_id = c.id), to_timestamp(0))
  ) as last_activity_at,
  coalesce((
    select count(*) from deals d
    where d.client_id = c.id and d.stage not in ('Won','Lost')
  ), 0) as open_deals_count,
  (
    select min(t.due_at) from tasks t
    where t.relates_to='client' and t.relates_id = c.id and coalesce(t.done, false) = false and t.due_at is not null
  ) as next_task_due_at
from clients c;

-- Final overview
create or replace view clients_overview as
select
  c.id,
  c.org_id,
  c.name,
  c.email,
  c.phone,
  c.company,
  c.status,
  c.tags,
  c.created_at,
  coalesce(cf.total_invoiced_cents, 0) as total_invoiced_cents,
  coalesce(cf.total_paid_cents, 0) as total_paid_cents,
  coalesce(cf.balance_due_cents, 0) as balance_due_cents,
  coalesce(cf.draft_invoiced_cents, 0) as draft_invoiced_cents,
  cdc.stage as current_stage,
  ca.last_activity_at,
  ca.open_deals_count,
  ca.next_task_due_at
from clients c
left join client_financials cf on cf.client_id = c.id
left join client_deal_current cdc on cdc.client_id = c.id
left join client_activity ca on ca.client_id = c.id;
