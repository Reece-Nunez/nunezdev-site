-- Create appointments table
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Meeting details
  meeting_type VARCHAR(50) NOT NULL DEFAULT 'discovery-call',
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,

  -- Contact information
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  client_phone VARCHAR(50),
  company_name VARCHAR(255),

  -- Meeting preferences
  meeting_platform VARCHAR(50) NOT NULL DEFAULT 'zoom', -- zoom, google-meet, phone, etc.
  project_details TEXT,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled, no-show

  -- Integration IDs
  google_calendar_event_id VARCHAR(255),
  zoom_meeting_id VARCHAR(255),

  -- Additional metadata
  timezone VARCHAR(100) DEFAULT 'America/Chicago',
  confirmation_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  meeting_notes TEXT
);

-- Create meeting types table for predefined options
CREATE TABLE meeting_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  color VARCHAR(7) DEFAULT '#ffc312', -- hex color
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default meeting types
INSERT INTO meeting_types (name, slug, description, duration_minutes) VALUES
('Discovery Call', 'discovery-call', 'Initial consultation to discuss your project goals and requirements', 30),
('Project Planning', 'project-planning', 'Detailed planning session for your development project', 60),
('Technical Review', 'technical-review', 'Review existing code or technical architecture', 45),
('Strategy Session', 'strategy-session', 'Business and technical strategy discussion', 90);

-- Create indexes for better performance
CREATE INDEX idx_appointments_date_time ON appointments(scheduled_date, scheduled_time);
CREATE INDEX idx_appointments_email ON appointments(client_email);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_meeting_type ON appointments(meeting_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_types ENABLE ROW LEVEL SECURITY;

-- Allow public read access to meeting types
CREATE POLICY "Allow public read access to meeting types" ON meeting_types
  FOR SELECT USING (true);

-- Allow public insert for appointments (booking form)
CREATE POLICY "Allow public insert for appointments" ON appointments
  FOR INSERT WITH CHECK (true);

-- Allow authenticated users (you) to manage appointments
CREATE POLICY "Allow admin full access to appointments" ON appointments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow admin full access to meeting types" ON meeting_types
  FOR ALL USING (auth.role() = 'service_role');