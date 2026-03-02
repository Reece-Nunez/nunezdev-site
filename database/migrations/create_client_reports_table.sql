-- Client Reports table for monthly retainer reports
create table if not exists client_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null references clients(id) on delete cascade,
  report_month date not null, -- first day of the month (e.g. 2026-03-01)
  report_data jsonb not null default '{}',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_client_reports_org on client_reports(org_id);
create index if not exists idx_client_reports_client on client_reports(client_id);
create index if not exists idx_client_reports_month on client_reports(org_id, report_month desc);

-- Unique constraint: one report per client per month
create unique index if not exists idx_client_reports_unique_month
  on client_reports(org_id, client_id, report_month);

-- Auto-update updated_at
create or replace function update_client_reports_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_client_reports_updated_at
  before update on client_reports
  for each row
  execute function update_client_reports_updated_at();

-- RLS
alter table client_reports enable row level security;

create policy "Service role full access on client_reports"
  on client_reports
  for all
  using (true)
  with check (true);
