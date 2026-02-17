-- === Enable RLS and basic policies ===

alter table clients enable row level security;
alter table deals enable row level security;
alter table notes enable row level security;
alter table tasks enable row level security;
alter table invoices enable row level security;

-- Clients
create policy clients_read on clients for select
  using (exists (select 1 from org_members m where m.org_id = clients.org_id and m.user_id = auth.uid()));

create policy clients_write on clients for all
  using (exists (select 1 from org_members m where m.org_id = clients.org_id and m.user_id = auth.uid() and m.role in ('owner','member')))
  with check (exists (select 1 from org_members m where m.org_id = clients.org_id and m.user_id = auth.uid() and m.role in ('owner','member')));

-- Deals
create policy deals_read on deals for select
  using (exists (select 1 from org_members m where m.org_id = deals.org_id and m.user_id = auth.uid()));

create policy deals_write on deals for all
  using (exists (select 1 from org_members m where m.org_id = deals.org_id and m.user_id = auth.uid() and m.role in ('owner','member')))
  with check (exists (select 1 from org_members m where m.org_id = deals.org_id and m.user_id = auth.uid() and m.role in ('owner','member')));

-- Notes
create policy notes_read on notes for select
  using (exists (select 1 from org_members m where m.org_id = notes.org_id and m.user_id = auth.uid()));

create policy notes_write on notes for all
  using (exists (select 1 from org_members m where m.org_id = notes.org_id and m.user_id = auth.uid() and m.role in ('owner','member')))
  with check (exists (select 1 from org_members m where m.org_id = notes.org_id and m.user_id = auth.uid() and m.role in ('owner','member')));

-- Tasks
create policy tasks_read on tasks for select
  using (exists (select 1 from org_members m where m.org_id = tasks.org_id and m.user_id = auth.uid()));

create policy tasks_write on tasks for all
  using (exists (select 1 from org_members m where m.org_id = tasks.org_id and m.user_id = auth.uid() and m.role in ('owner','member')))
  with check (exists (select 1 from org_members m where m.org_id = tasks.org_id and m.user_id = auth.uid() and m.role in ('owner','member')));

-- Invoices
create policy invoices_read on invoices for select
  using (exists (select 1 from org_members m where m.org_id = invoices.org_id and m.user_id = auth.uid()));

create policy invoices_write on invoices for all
  using (exists (select 1 from org_members m where m.org_id = invoices.org_id and m.user_id = auth.uid() and m.role in ('owner','member')))
  with check (exists (select 1 from org_members m where m.org_id = invoices.org_id and m.user_id = auth.uid() and m.role in ('owner','member')));
