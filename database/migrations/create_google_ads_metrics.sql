-- Google Ads performance snapshots (campaign + keyword level)
--
-- A daily cron (/api/cron/leadgen-google-ads-sync) and a manual dashboard
-- refresh pull metrics from the Google Ads API and upsert them here, one row
-- per (entity, day). The dashboard at /dashboard/leadgen/ads reads from these
-- tables — never live from Google — so page loads are fast and we keep history
-- for trend charts even after Google's own UI rolls dates off.
--
-- Design notes:
--   * Cost is stored as raw `cost_micros` (Google's integer micros, 1e6 = $1).
--     That's the precise source of truth; the UI derives dollars. Storing a
--     rounded dollar float would lose cents across aggregation.
--   * Upserts are idempotent: re-syncing a day (today's numbers change through
--     the day) overwrites that day's row via the unique index below. The sync
--     code's onConflict target must match these indexes exactly.
--   * RLS is fail-closed, service-role only — matching create_inbox_tables.sql
--     and create_thumbtack_events.sql. Only the service-role key (cron +
--     server-side reads) touches these tables; no browser client does.

-- ── Campaign-level daily metrics ──────────────────────────────────────────
create table if not exists google_ads_campaign_metrics (
  id uuid primary key default gen_random_uuid(),

  date         date   not null,          -- the calendar day these metrics cover
  customer_id  text   not null,          -- Google Ads account id (digits only)
  campaign_id  text   not null,
  campaign_name text  not null,
  status       text,                     -- ENABLED | PAUSED | REMOVED
  channel_type text,                     -- SEARCH | DISPLAY | PERFORMANCE_MAX | ...

  impressions  bigint  not null default 0,
  clicks       bigint  not null default 0,
  cost_micros  bigint  not null default 0,
  conversions       numeric not null default 0,  -- can be fractional (Google attributes partials)
  conversions_value numeric not null default 0,

  synced_at    timestamptz not null default now()
);

-- Idempotency + upsert target: one row per campaign per day.
create unique index if not exists idx_gads_campaign_date
  on google_ads_campaign_metrics(date, campaign_id);

-- Date-range scans for the dashboard.
create index if not exists idx_gads_campaign_date_only
  on google_ads_campaign_metrics(date);

-- ── Keyword-level daily metrics ───────────────────────────────────────────
create table if not exists google_ads_keyword_metrics (
  id uuid primary key default gen_random_uuid(),

  date          date not null,
  customer_id   text not null,
  campaign_id   text not null,
  campaign_name text not null,
  ad_group_id   text not null,
  ad_group_name text not null,
  criterion_id  text not null,           -- Google's keyword (criterion) id
  keyword_text  text not null,
  match_type    text,                    -- EXACT | PHRASE | BROAD

  impressions  bigint  not null default 0,
  clicks       bigint  not null default 0,
  cost_micros  bigint  not null default 0,
  conversions       numeric not null default 0,
  conversions_value numeric not null default 0,

  synced_at    timestamptz not null default now()
);

-- A keyword (criterion) is unique within an ad group; key the upsert on the
-- triple so the same keyword id reused across ad groups never collides.
create unique index if not exists idx_gads_keyword_date
  on google_ads_keyword_metrics(date, ad_group_id, criterion_id);

create index if not exists idx_gads_keyword_date_only
  on google_ads_keyword_metrics(date);

-- ── RLS (fail-closed, service-role only) ──────────────────────────────────
alter table google_ads_campaign_metrics enable row level security;
alter table google_ads_keyword_metrics  enable row level security;

drop policy if exists "Service role full access on google_ads_campaign_metrics"
  on google_ads_campaign_metrics;
create policy "Service role full access on google_ads_campaign_metrics"
  on google_ads_campaign_metrics for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role full access on google_ads_keyword_metrics"
  on google_ads_keyword_metrics;
create policy "Service role full access on google_ads_keyword_metrics"
  on google_ads_keyword_metrics for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
