-- Multi-site support (Phase 1: schema + backfill).
--
-- A client can have several distinct websites/projects, each with its own
-- GA4 / Vercel / Search Console wiring and its own monthly report. Until now
-- those four fields lived directly on `clients` (one site per client); they
-- move to `client_sites` (one row per site). The `clients.*` columns are kept
-- as the backfill source and for back-compat — new code reads `client_sites`.

create table if not exists public.client_sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null default 'Primary',
  website_url text,
  ga4_property_id text,
  vercel_project_id text,
  gsc_site_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_sites_client on public.client_sites(client_id);
create index if not exists idx_client_sites_org on public.client_sites(org_id);

alter table public.client_sites enable row level security;

drop policy if exists "Org members manage own client_sites" on public.client_sites;
create policy "Org members manage own client_sites" on public.client_sites
  for all
  using (org_id in (select org_id from org_members where user_id = auth.uid()))
  with check (org_id in (select org_id from org_members where user_id = auth.uid()));

-- Reports become site-scoped. Nullable + ON DELETE SET NULL so legacy
-- client-level reports and history survive a site being deleted. The existing
-- unique index (org_id, client_id, report_month) is intentionally left in place
-- for now; it's replaced with a site-aware one when per-site report writing
-- ships (Phase 3).
alter table public.client_reports
  add column if not exists site_id uuid references public.client_sites(id) on delete set null;

create index if not exists idx_client_reports_site on public.client_reports(site_id);

-- Backfill: one "Primary" site per client that already has a website, copying
-- its existing integration fields. Guarded so re-running is a no-op.
insert into public.client_sites (org_id, client_id, label, website_url, ga4_property_id, vercel_project_id, gsc_site_url)
select c.org_id, c.id, 'Primary', c.website_url, c.ga4_property_id, c.vercel_project_id, c.gsc_site_url
from public.clients c
where c.website_url is not null and c.website_url <> ''
  and not exists (select 1 from public.client_sites cs where cs.client_id = c.id);

-- Link existing reports to their client's (single, just-created) primary site.
update public.client_reports cr
set site_id = cs.id
from public.client_sites cs
where cs.client_id = cr.client_id and cr.site_id is null;
