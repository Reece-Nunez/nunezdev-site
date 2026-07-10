-- Per-site GitHub repository, used to automate the dependency-vulnerability
-- check (Dependabot alerts) in the monthly report. Format is "owner/name"
-- (e.g. "Reece-Nunez/nunezdev-site"). Nullable — sites without a repo simply
-- skip the automated npm-audit check and leave that item pending.
--
-- Requires a read-only GITHUB_TOKEN in the environment with the "Dependabot
-- alerts: read" permission on the relevant repos.

alter table public.client_sites
  add column if not exists github_repo text;
