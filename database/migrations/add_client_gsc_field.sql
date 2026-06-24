-- Add Google Search Console site URL to clients for report automation.
-- Stored verbatim as GSC expects it: either a URL-prefix property
-- ("https://example.com/") or a domain property ("sc-domain:example.com").
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gsc_site_url TEXT;
