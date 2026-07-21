-- Thumbtack Partner Platform OAuth token store (authorization_code flow)
--
-- The supply-side Partner API (associate phone numbers, outbound messages) is
-- gated on the OAuth2 *authorization_code* grant, NOT client_credentials — the
-- NunezDev client is provisioned only for authorization_code, and per the
-- published OpenAPI spec the supply:: scopes live under that flow. So the owner
-- consents once at /api/thumbtack, and /api/thumbtack/callback exchanges the
-- code for an access + refresh token pair which we persist here and refresh as
-- needed (access token ~1 hr; refresh token ~180 days, single-use).
--
-- One row per org (NunezDev is single-tenant, but org-keying keeps it honest).
-- RLS is fail-closed, service-role only — matching create_thumbtack_events.sql.
-- Reads/writes go through the service-role key (src/lib/supabaseAdmin.ts).
--
-- SECURITY NOTE: tokens are stored as-is (no app-layer encryption), same
-- posture as the rest of this service-role-only data. They grant access to the
-- Thumbtack account, so a follow-up to encrypt at rest (pgcrypto or app-layer
-- AES-GCM keyed off an env secret) is worthwhile before multi-tenant use.

create table if not exists thumbtack_oauth_tokens (
  -- The org that consented. requireOwner() returns this in the callback.
  org_id uuid primary key,

  access_token text not null,
  -- Present only when the consent requested offline_access. Absent means the
  -- connection can't self-refresh and the owner must re-consent when it lapses.
  refresh_token text,

  -- Space-delimited scopes actually granted (echoed back by the token endpoint).
  scope text,
  token_type text,

  -- Absolute expiry of access_token, computed from expires_in at exchange time.
  expires_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── RLS (fail-closed, service-role only) ─────────────────────────────────
alter table thumbtack_oauth_tokens enable row level security;

drop policy if exists "Service role full access on thumbtack_oauth_tokens" on thumbtack_oauth_tokens;
create policy "Service role full access on thumbtack_oauth_tokens"
  on thumbtack_oauth_tokens for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
