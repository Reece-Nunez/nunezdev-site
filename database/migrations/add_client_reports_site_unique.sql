-- Per-site reports (Phase 3): one report per (client, site, month) instead of
-- per (client, month). NULLS NOT DISTINCT (Postgres 15+) so legacy site-less
-- reports still dedupe per client/month.
drop index if exists public.idx_client_reports_unique_month;

create unique index if not exists idx_client_reports_unique_site_month
  on public.client_reports (org_id, client_id, site_id, report_month)
  nulls not distinct;
