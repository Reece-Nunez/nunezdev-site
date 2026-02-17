-- Fix Last Activity issue - replace to_timestamp(0) with NULL
-- This prevents showing 12/31/1969 dates and shows "—" instead

create or replace view client_activity as
select
  c.id as client_id,
  case 
    when greatest(
      coalesce((select max(d.created_at) from deals d where d.client_id = c.id), '1900-01-01'::timestamptz),
      coalesce((select max(n.created_at) from notes n where n.relates_to='client' and n.relates_id = c.id), '1900-01-01'::timestamptz),
      coalesce((select max(i.issued_at) from invoices i where i.client_id = c.id), '1900-01-01'::timestamptz),
      coalesce((select max(t.created_at) from tasks t where t.relates_to='client' and t.relates_id = c.id), '1900-01-01'::timestamptz)
    ) = '1900-01-01'::timestamptz 
    then null
    else greatest(
      coalesce((select max(d.created_at) from deals d where d.client_id = c.id), '1900-01-01'::timestamptz),
      coalesce((select max(n.created_at) from notes n where n.relates_to='client' and n.relates_id = c.id), '1900-01-01'::timestamptz),
      coalesce((select max(i.issued_at) from invoices i where i.client_id = c.id), '1900-01-01'::timestamptz),
      coalesce((select max(t.created_at) from tasks t where t.relates_to='client' and t.relates_id = c.id), '1900-01-01'::timestamptz)
    )
  end as last_activity_at,
  coalesce((
    select count(*) from deals d
    where d.client_id = c.id and d.stage not in ('Won','Lost')
  ), 0) as open_deals_count,
  (
    select min(t.due_at) from tasks t
    where t.relates_to='client' and t.relates_id = c.id and coalesce(t.done, false) = false and t.due_at is not null
  ) as next_task_due_at
from clients c;