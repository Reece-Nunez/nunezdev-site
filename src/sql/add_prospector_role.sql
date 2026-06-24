-- Add a restricted 'prospector' role to org_members.
--
-- Motivation: a teammate (Josh) helped design the lead-generation features and
-- needs to use ONLY that surface (leadgen / leads CRM / thumbtack) — never the
-- financial side. The app was single-owner until now, so org_members only knew
-- 'owner' | 'member' | 'viewer'. This adds 'prospector'.
--
-- What 'prospector' is allowed to reach is enforced in the app layer, not RLS:
--   - per-route guards via requireProspecting() (src/lib/authz.ts)
--   - a deny-by-default backstop in middleware (src/lib/prospectorAccess.ts)
-- Data scoping still uses org_members.role; a denormalized app_metadata.role
-- flag on the auth user lets middleware detect the role from the JWT cheaply.

alter table org_members drop constraint if exists org_members_role_check;
alter table org_members
  add constraint org_members_role_check
  check (role in ('owner','member','viewer','prospector'));
