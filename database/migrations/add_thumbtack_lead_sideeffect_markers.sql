-- Per-negotiation idempotency markers for Thumbtack new-lead side effects.
--
-- Why: the owner SMS alert and the instant auto-reply were gated on whether
-- `upsertLeadFromThumbtack` INSERTED the leads row (created === true). But a new
-- lead fires BOTH MessageCreatedV4 and NegotiationCreatedV4 within ~1s, and if
-- the message lands first, touchLeadFromMessage creates the lead first — so the
-- NegotiationCreatedV4 sees an existing row, created is false, and BOTH side
-- effects are skipped (observed on lead "David Laurie", negotiation
-- 585635485432135684, 2026-07-23).
--
-- Fix: gate each side effect on its own marker instead, and fire on the
-- NegotiationCreatedV4 event regardless of who created the row. The marker is
-- stamped only on a SUCCESSFUL send, so a failed send retries on redelivery.

alter table leads
  add column if not exists thumbtack_alerted_at timestamptz,
  add column if not exists thumbtack_auto_replied_at timestamptz;

-- Backfill: treat every existing Thumbtack lead as already handled so the new
-- fire-once logic only acts on genuinely new leads going forward (never a late
-- auto-reply to an old lead a redelivery happens to re-surface).
update leads
  set thumbtack_alerted_at = coalesce(thumbtack_alerted_at, now()),
      thumbtack_auto_replied_at = coalesce(thumbtack_auto_replied_at, now())
  where thumbtack_negotiation_id is not null;
