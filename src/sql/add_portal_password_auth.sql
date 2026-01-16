-- Add password authentication to client portal users
-- Run this in Supabase SQL Editor

-- Add password_hash column for email/password login
ALTER TABLE client_portal_users
ADD COLUMN IF NOT EXISTS password_hash text;

-- Add google_id column for Google OAuth
ALTER TABLE client_portal_users
ADD COLUMN IF NOT EXISTS google_id text UNIQUE;

-- Add name column for display purposes
ALTER TABLE client_portal_users
ADD COLUMN IF NOT EXISTS name text;

-- Index for Google OAuth lookups
CREATE INDEX IF NOT EXISTS idx_client_portal_users_google_id
ON client_portal_users(google_id) WHERE google_id IS NOT NULL;
