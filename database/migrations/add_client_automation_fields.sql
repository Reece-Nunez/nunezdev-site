-- Add fields to clients table for report automation
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS ga4_property_id TEXT,
  ADD COLUMN IF NOT EXISTS vercel_project_id TEXT;
