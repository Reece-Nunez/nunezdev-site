-- Create onboarding projects table
CREATE TABLE IF NOT EXISTS onboarding_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  project_type VARCHAR(100) NOT NULL,
  template_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  estimated_completion_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create onboarding tasks table
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  task_id VARCHAR(100) NOT NULL, -- Template task ID
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('client', 'admin', 'technical')),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  estimated_time_minutes INTEGER,
  depends_on TEXT[] DEFAULT '{}', -- Array of task_id values
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'in_progress', 'completed', 'skipped')),
  assigned_to VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'client', 'admin', or specific user ID
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by VARCHAR(255),
  completion_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create onboarding templates table (for future use)
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create template tasks table (for future use)
CREATE TABLE IF NOT EXISTS template_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES onboarding_templates(id) ON DELETE CASCADE,
  task_id VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  estimated_time_minutes INTEGER,
  depends_on TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create onboarding communications table
CREATE TABLE IF NOT EXISTS onboarding_communications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  communication_type VARCHAR(100) NOT NULL, -- 'welcome_email', 'progress_update', 'task_reminder', 'completion_notice'
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  content TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_projects_client_id ON onboarding_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_projects_status ON onboarding_projects(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_project_id ON onboarding_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_status ON onboarding_tasks(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_assigned_to ON onboarding_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_order ON onboarding_tasks(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_onboarding_communications_project_id ON onboarding_communications(project_id);

-- Add foreign key constraint for clients (if table exists)
-- ALTER TABLE onboarding_projects ADD CONSTRAINT fk_onboarding_projects_client
-- FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_onboarding_projects_updated_at
  BEFORE UPDATE ON onboarding_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_tasks_updated_at
  BEFORE UPDATE ON onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_templates_updated_at
  BEFORE UPDATE ON onboarding_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE onboarding_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_communications ENABLE ROW LEVEL SECURITY;

-- Allow service role to access everything
CREATE POLICY "Service role can manage onboarding_projects" ON onboarding_projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage onboarding_tasks" ON onboarding_tasks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage onboarding_templates" ON onboarding_templates FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage template_tasks" ON template_tasks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage onboarding_communications" ON onboarding_communications FOR ALL USING (auth.role() = 'service_role');