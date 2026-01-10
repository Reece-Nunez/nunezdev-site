-- Google Workspace Integration Schema
-- Adds sync tracking for bidirectional Google Workspace integration

-- Add Google IDs to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS google_contact_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS google_contact_etag TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS google_last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_google_contact_id ON clients(google_contact_id);
CREATE INDEX IF NOT EXISTS idx_clients_google_drive_folder_id ON clients(google_drive_folder_id);

-- Add Google Task ID to onboarding_tasks
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS google_task_id TEXT,
  ADD COLUMN IF NOT EXISTS google_task_etag TEXT,
  ADD COLUMN IF NOT EXISTS google_last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_google_task_id ON onboarding_tasks(google_task_id);

-- Google Calendar Events Tracking (for appointments/meetings)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  google_event_id TEXT NOT NULL UNIQUE,
  google_calendar_id TEXT NOT NULL DEFAULT 'primary',
  google_event_etag TEXT,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('confirmed', 'tentative', 'cancelled')) DEFAULT 'confirmed',
  meeting_link TEXT,
  attendees JSONB DEFAULT '[]',
  source TEXT CHECK (source IN ('local', 'google')) DEFAULT 'local',
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_org_id ON calendar_events(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_client_id ON calendar_events(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_event_id ON calendar_events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);

-- Google Drive Documents Tracking
CREATE TABLE IF NOT EXISTS client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  google_file_id TEXT NOT NULL UNIQUE,
  google_file_etag TEXT,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  web_view_link TEXT,
  web_content_link TEXT,
  parent_folder_id TEXT,
  category TEXT CHECK (category IN ('contract', 'invoice', 'proposal', 'asset', 'deliverable', 'other')) DEFAULT 'other',
  uploaded_by TEXT,
  source TEXT CHECK (source IN ('local', 'google')) DEFAULT 'local',
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_documents_org_id ON client_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_google_file_id ON client_documents(google_file_id);

-- Sync Status Tracking (for conflict resolution and audit)
CREATE TABLE IF NOT EXISTS google_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'calendar', 'task', 'document', 'sheet')),
  entity_id UUID NOT NULL,
  google_id TEXT NOT NULL,
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('to_google', 'from_google')),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('success', 'conflict', 'error', 'skipped')),
  conflict_resolution TEXT,
  error_message TEXT,
  local_data JSONB,
  google_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_sync_log_entity ON google_sync_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_log_synced_at ON google_sync_log(synced_at DESC);

-- Sync Watermarks (track last sync position for incremental sync)
CREATE TABLE IF NOT EXISTS google_sync_watermarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('contacts', 'calendar', 'tasks', 'drive')),
  sync_token TEXT,
  last_full_sync_at TIMESTAMPTZ,
  last_incremental_sync_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, service)
);

-- RLS Policies
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_sync_watermarks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Service role can manage calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Service role can manage client_documents" ON client_documents;
DROP POLICY IF EXISTS "Service role can manage google_sync_log" ON google_sync_log;
DROP POLICY IF EXISTS "Service role can manage google_sync_watermarks" ON google_sync_watermarks;
DROP POLICY IF EXISTS "Users can view calendar_events for their org" ON calendar_events;
DROP POLICY IF EXISTS "Users can view client_documents for their org" ON client_documents;

-- Service role policies (for API routes)
CREATE POLICY "Service role can manage calendar_events" ON calendar_events FOR ALL USING (true);
CREATE POLICY "Service role can manage client_documents" ON client_documents FOR ALL USING (true);
CREATE POLICY "Service role can manage google_sync_log" ON google_sync_log FOR ALL USING (true);
CREATE POLICY "Service role can manage google_sync_watermarks" ON google_sync_watermarks FOR ALL USING (true);

-- User access policies (for authenticated users)
CREATE POLICY "Users can view calendar_events for their org" ON calendar_events
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view client_documents for their org" ON client_documents
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
