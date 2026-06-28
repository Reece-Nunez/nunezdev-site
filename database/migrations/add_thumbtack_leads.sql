-- Let Thumbtack leads flow into the leads pipeline instead of only being logged
-- as an expense. Two changes:
--
-- 1. leads.source: widen the CHECK to allow 'thumbtack' so we can tell where a
--    lead came from (and report ROI on it).
-- 2. leads.thumbtack_negotiation_id: the Thumbtack negotiation id, used as the
--    idempotent upsert key so a redelivered webhook updates the same lead
--    instead of creating duplicates. Unique where present.
--
-- Applied to the NunezDev Supabase project on 2026-06-27.

alter table public.leads drop constraint leads_source_check;

alter table public.leads add constraint leads_source_check
  check (source in ('contact_form', 'appointment', 'manual', 'thumbtack'));

-- Thumbtack (and phone-only inbound leads) have no email, but the column was
-- created NOT NULL. Relax it so a lead can exist with just a name + phone.
alter table public.leads alter column email drop not null;

alter table public.leads add column if not exists thumbtack_negotiation_id text;

create unique index if not exists leads_thumbtack_negotiation_id_key
  on public.leads (thumbtack_negotiation_id)
  where thumbtack_negotiation_id is not null;
