-- 2026-06-15 — Security hardening (applied to project igbwyavfigobwdqjljui via
-- Supabase MCP migrations). Recorded here for version control / traceability.
--
-- Context: triggered by reviewing an inbound "beg bounty" report (a non-issue:
-- "sessions not invalidated on password change"). The review surfaced the
-- Supabase security advisors below, which included a genuine, unauthenticated
-- data-exposure bug. These migrations close the real issues.
--
-- Migrations applied (in order):
--   1. harden_function_search_path_and_drop_public_appointments_insert
--   2. fix_public_rls_exposure_on_client_and_sync_tables
--   3. drop_public_insert_policies_on_notifications_and_logs


-- ============================================================================
-- Migration 1: harden_function_search_path_and_drop_public_appointments_insert
-- ============================================================================

-- 1a) Pin search_path on all user-defined (non-extension) functions in public.
--     A mutable search_path lets a caller shadow built-ins/objects the function
--     references. All 22 targeted functions reference public tables unqualified,
--     so `public, pg_temp` (pg_temp last, to prevent temp-object shadowing) is
--     the minimal value that is both safe and non-breaking. Extension-owned
--     functions (citext) are excluded via pg_depend deptype = 'e'.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
        WHERE c LIKE 'search_path=%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

-- 1b) Drop the unrestricted public INSERT policy on appointments. The booking
--     flow (src/app/api/appointments/route.ts) inserts via the service-role
--     client and is gated by Cloudflare Turnstile, so this policy was unused by
--     the app and only let anyone with the anon key write appointment rows
--     directly, bypassing Turnstile. The service-role policy remains.
DROP POLICY IF EXISTS "Allow public insert for appointments" ON public.appointments;


-- ============================================================================
-- Migration 2: fix_public_rls_exposure_on_client_and_sync_tables
-- ============================================================================
-- Five tables had a policy granted to PUBLIC (anon + authenticated) with
-- USING (true), intended as "service role only". Because the anon key ships in
-- the browser bundle, this allowed unauthenticated reads/writes of ALL rows
-- across ALL orgs (confirmed: the anon role could SELECT client_reports). The
-- service role bypasses RLS entirely, so these policies were never needed for
-- the intended server-side access — they only opened the hole.

-- client_reports: accessed by the dashboard as the AUTHENTICATED user
-- (src/app/api/client-reports/**, via supabaseServer): SELECT, upsert, and
-- UPDATE sent_at, always filtered by org_id. Replace the public hole with a
-- proper org-scoped policy so the dashboard keeps working while anon is denied.
DROP POLICY IF EXISTS "Service role full access on client_reports" ON public.client_reports;
CREATE POLICY "Org members manage own client_reports" ON public.client_reports
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- calendar_events & client_documents: not written by app code; each already has
-- an authenticated org-scoped SELECT policy. Just remove the public hole.
DROP POLICY IF EXISTS "Service role can manage calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Service role can manage client_documents" ON public.client_documents;

-- google_sync_log & google_sync_watermarks: accessed only by syncEngine.ts via
-- the service-role client (which bypasses RLS). Drop the public hole; the tables
-- become deny-by-default for anon/authenticated, exactly like audit_logs.
DROP POLICY IF EXISTS "Service role can manage google_sync_log" ON public.google_sync_log;
DROP POLICY IF EXISTS "Service role can manage google_sync_watermarks" ON public.google_sync_watermarks;


-- ============================================================================
-- Migration 3: drop_public_insert_policies_on_notifications_and_logs
-- ============================================================================
-- notifications and recurring_invoice_logs each had an INSERT policy granted to
-- PUBLIC with WITH CHECK (true), letting anyone with the anon key insert
-- arbitrary rows (spam / forged activity). Both tables are only written
-- server-side via the service-role client, which bypasses RLS:
--   * notifications          <- src/lib/notifications.ts (supabaseAdmin)
--   * recurring_invoice_logs  <- src/app/api/recurring-invoices/process/route.ts (supabaseAdmin)
-- Drop the public INSERT policies. The org-scoped authenticated policies remain:
--   * notifications: "Org members can read own notifications" (SELECT),
--                    "Org members can update own notifications" (UPDATE)
--   * recurring_invoice_logs: "Users can view logs for their org" (SELECT)
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert logs" ON public.recurring_invoice_logs;
