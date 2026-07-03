-- Keyword Planner search-volume cache (read-through)
--
-- Backs the outreach "N people a month search for a {trade} around {city}"
-- line. The Google Ads Keyword Planner (KeywordPlanIdeaService) is the source
-- of truth; each lookup is expensive (two API calls: geo resolve + keyword
-- ideas) and the numbers barely move month to month, so we cache one row per
-- (keyword, metro) and only re-fetch when a row is older than ~30 days.
--
-- Read path: /api/keyword-volume (called by the leadgen pipeline while building
-- outreach copy) → getKeywordVolume() → this table (hit) or Google (miss/stale).
--
-- Design notes:
--   * avg_monthly_searches is Google's rounded estimate (a bucketed integer,
--     not an exact count). Stored as bigint; 0 means "no data / unknown", which
--     callers treat as "omit the demand line" rather than "zero demand".
--   * geo_target_id is the resolved geoTargetConstants/<id> for the metro, kept
--     for debugging which geo a number actually came from.
--   * Upsert target is (keyword, metro); re-fetching a stale row overwrites it.
--   * RLS is fail-closed, service-role only — matching create_google_ads_metrics.sql.
--     Only server-side code with the service-role key reads/writes this table.

create table if not exists keyword_search_volume (
  id uuid primary key default gen_random_uuid(),

  keyword       text   not null,          -- normalized seed (lowercased, e.g. "plumber")
  metro         text   not null,          -- "City, State" label the volume is scoped to
  geo_target_id text,                     -- resolved Google geo-target constant id (digits)

  avg_monthly_searches bigint not null default 0,  -- Google's estimate; 0 = unknown

  fetched_at    timestamptz not null default now() -- when this number came from Google
);

-- Idempotency + upsert target: one cached number per keyword per metro.
create unique index if not exists idx_keyword_volume_kw_metro
  on keyword_search_volume(keyword, metro);

-- RLS: fail-closed, service-role only.
alter table keyword_search_volume enable row level security;

drop policy if exists "Service role full access on keyword_search_volume"
  on keyword_search_volume;
create policy "Service role full access on keyword_search_volume"
  on keyword_search_volume for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
