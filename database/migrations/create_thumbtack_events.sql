-- Thumbtack webhook landing table (raw events)
--
-- Thumbtack's webhook pushes three event kinds to /api/thumbtack/webhook:
-- new lead details, new customer messages, and new reviews. This table is a
-- deliberate *raw* landing zone — we store each delivery verbatim as jsonb and
-- map it into the inbox (conversations/messages) in a separate pass.
--
-- Why land raw first instead of writing straight into the inbox:
--   * We don't yet know Thumbtack's exact payload shape (no API access at
--     scaffold time). Capturing raw lets us inspect real deliveries before
--     committing to a mapping, with zero risk a malformed payload corrupts the
--     live inbox.
--   * Webhooks redeliver on non-2xx. A durable raw row + idempotency key means
--     a retry is a no-op, and reprocessing is just re-reading stored jsonb.
--   * RLS is fail-closed, service-role only — matching the 385a1bd hardening
--     and create_inbox_tables.sql. The webhook writes with the service-role key.

create table if not exists thumbtack_events (
  id uuid primary key default gen_random_uuid(),

  -- Best-effort classification pulled from the payload at receive time
  -- ('lead_details' | 'messages' | 'reviews' | whatever Thumbtack actually
  -- sends). Nullable because we won't fail a delivery just for an unrecognized
  -- shape — the raw payload is always retained regardless.
  event_type text,

  -- Thumbtack's own id for this event/lead, when present. The durable
  -- idempotency anchor: a redelivery of the same event must not double-insert.
  external_id text,

  -- Which Thumbtack business/profile this came from (the form lets you scope a
  -- webhook to one profile). Snapshot for later routing; nullable.
  business_id text,

  -- The delivery, verbatim. Source of truth for the mapping pass.
  payload jsonb not null,

  -- Mapping bookkeeping: flipped true once this event has been turned into a
  -- conversation/message (or otherwise handled). Lets a backfill job find work.
  processed boolean not null default false,
  processed_at timestamptz,

  received_at timestamptz not null default now()
);

-- Idempotency: a webhook retry (Thumbtack redelivers on timeout / non-2xx)
-- must not insert a duplicate. Unique on external_id where Thumbtack gave us one.
create unique index if not exists idx_thumbtack_events_external_id
  on thumbtack_events(external_id) where external_id is not null;

-- Backfill/processing scan: find unhandled events oldest-first.
create index if not exists idx_thumbtack_events_unprocessed
  on thumbtack_events(received_at) where processed = false;

-- ── RLS (fail-closed, service-role only) ─────────────────────────────────
alter table thumbtack_events enable row level security;

drop policy if exists "Service role full access on thumbtack_events" on thumbtack_events;
create policy "Service role full access on thumbtack_events"
  on thumbtack_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
