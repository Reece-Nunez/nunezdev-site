-- Invoice view tracking (client opened the public invoice link)
--
-- The client reaches an invoice the same way regardless of how it was sent
-- (email or text): by opening the public link /invoice/<access_token>, which
-- loads via GET /api/public/invoice/[token]. Recording the open there gives a
-- single, channel-agnostic "the client saw this invoice" signal — mirroring how
-- proposals already stamp viewed_at.
--
-- Kept in dedicated columns (NOT the invoice `status`, which tracks payment
-- state — draft/sent/paid/void/etc. — and must not be overloaded).
--   viewed_at      first time the client opened it
--   last_viewed_at most recent open
--   view_count     number of distinct opens (debounced in app code so one page
--                  load's duplicate fetches don't inflate it)

alter table invoices
  add column if not exists viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count integer not null default 0;
