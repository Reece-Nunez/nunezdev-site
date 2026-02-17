-- Client Portal Tables Migration
-- Run this in Supabase SQL Editor

-- 1. Client portal users (magic link auth)
CREATE TABLE IF NOT EXISTS client_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  access_token text UNIQUE,
  token_expires_at timestamptz,
  last_login_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, email)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_client_portal_users_token ON client_portal_users(access_token);
CREATE INDEX IF NOT EXISTS idx_client_portal_users_client ON client_portal_users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_users_email ON client_portal_users(email);

-- 2. Projects that clients can upload to
CREATE TABLE IF NOT EXISTS client_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  s3_prefix text NOT NULL,
  status text CHECK (status IN ('active', 'completed', 'archived')) DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_projects_client ON client_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_org ON client_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_status ON client_projects(status);

-- 3. Track uploaded files
CREATE TABLE IF NOT EXISTS client_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES client_portal_users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  s3_key text NOT NULL UNIQUE,
  upload_status text CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')) DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_uploads_project ON client_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_client_uploads_status ON client_uploads(upload_status);
CREATE INDEX IF NOT EXISTS idx_client_uploads_s3_key ON client_uploads(s3_key);

-- Enable Row Level Security
ALTER TABLE client_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin users can manage all portal data in their org

-- client_portal_users policies
CREATE POLICY client_portal_users_select ON client_portal_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN org_members m ON m.org_id = c.org_id
      WHERE c.id = client_portal_users.client_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY client_portal_users_insert ON client_portal_users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN org_members m ON m.org_id = c.org_id
      WHERE c.id = client_portal_users.client_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'member')
    )
  );

CREATE POLICY client_portal_users_update ON client_portal_users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN org_members m ON m.org_id = c.org_id
      WHERE c.id = client_portal_users.client_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'member')
    )
  );

CREATE POLICY client_portal_users_delete ON client_portal_users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN org_members m ON m.org_id = c.org_id
      WHERE c.id = client_portal_users.client_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'member')
    )
  );

-- client_projects policies
CREATE POLICY client_projects_select ON client_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members m
      WHERE m.org_id = client_projects.org_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY client_projects_insert ON client_projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members m
      WHERE m.org_id = client_projects.org_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'member')
    )
  );

CREATE POLICY client_projects_update ON client_projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_members m
      WHERE m.org_id = client_projects.org_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'member')
    )
  );

CREATE POLICY client_projects_delete ON client_projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM org_members m
      WHERE m.org_id = client_projects.org_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'member')
    )
  );

-- client_uploads policies
CREATE POLICY client_uploads_select ON client_uploads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_projects p
      JOIN org_members m ON m.org_id = p.org_id
      WHERE p.id = client_uploads.project_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY client_uploads_insert ON client_uploads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_projects p
      JOIN org_members m ON m.org_id = p.org_id
      WHERE p.id = client_uploads.project_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'member')
    )
  );

CREATE POLICY client_uploads_update ON client_uploads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM client_projects p
      JOIN org_members m ON m.org_id = p.org_id
      WHERE p.id = client_uploads.project_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'member')
    )
  );

CREATE POLICY client_uploads_delete ON client_uploads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM client_projects p
      JOIN org_members m ON m.org_id = p.org_id
      WHERE p.id = client_uploads.project_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'member')
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_client_portal_users_updated_at ON client_portal_users;
CREATE TRIGGER update_client_portal_users_updated_at
  BEFORE UPDATE ON client_portal_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_projects_updated_at ON client_projects;
CREATE TRIGGER update_client_projects_updated_at
  BEFORE UPDATE ON client_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_uploads_updated_at ON client_uploads;
CREATE TRIGGER update_client_uploads_updated_at
  BEFORE UPDATE ON client_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
