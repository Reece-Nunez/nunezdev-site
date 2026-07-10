-- Monthly per-site snapshots that power month-over-month report insights:
--   * Search Console clicks/impressions  -> SEO trend
--   * sitemap URL list                    -> "new content since last month"
--
-- One row per (site, month), written during the report Auto-Fill run and read
-- back next month to compute deltas. Site-less legacy reports simply don't get
-- a snapshot (and therefore no trend), which is fine.

create table if not exists public.client_site_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null references public.client_sites(id) on delete cascade,
  report_month date not null, -- first day of the month
  gsc_clicks integer,
  gsc_impressions integer,
  sitemap_urls jsonb, -- array of <loc> URL strings
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, report_month)
);

create index if not exists idx_site_snapshots_site
  on public.client_site_snapshots(site_id, report_month desc);
create index if not exists idx_site_snapshots_org
  on public.client_site_snapshots(org_id);

alter table public.client_site_snapshots enable row level security;

drop policy if exists "Org members manage own site snapshots" on public.client_site_snapshots;
create policy "Org members manage own site snapshots" on public.client_site_snapshots
  for all
  using (org_id in (select org_id from org_members where user_id = auth.uid()))
  with check (org_id in (select org_id from org_members where user_id = auth.uid()));
