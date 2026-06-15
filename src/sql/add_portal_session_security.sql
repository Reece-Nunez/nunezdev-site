-- 2026-06-15 — Portal auth hardening (applied via Supabase MCP migration
-- `add_portal_session_security_columns`). Recorded here for version control.
--
-- Supports three app-side hardening features in the client portal:
--   * session_version       - stateless portal JWTs embed this value; it is
--                             compared on every verify (src/lib/portalAuth.ts).
--                             set-password bumps it to invalidate all existing
--                             sessions on other devices.
--   * failed_login_attempts - consecutive failed password logins.
--   * locked_until          - brute-force lockout window; the portal login route
--                             rejects logins (HTTP 429) until this passes
--                             (5 failures -> 15 minute lock).
ALTER TABLE public.client_portal_users
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;
