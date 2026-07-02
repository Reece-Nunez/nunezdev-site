-- SMS follow-up cadence queue (the SMS twin of scheduled_emails).
-- One row per (lead, step); the process-sms-sequences cron sends due rows.
-- Applied via Supabase migration `create_scheduled_sms`.
create table if not exists scheduled_sms (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  step smallint not null,
  body text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending', -- pending | sent | failed | canceled
  sent_at timestamptz,
  twilio_sid text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (lead_id, step)
);

create index if not exists scheduled_sms_due_idx on scheduled_sms (scheduled_for) where status = 'pending';
create index if not exists scheduled_sms_lead_idx on scheduled_sms (lead_id);

-- Fail-closed: the app uses the service-role key, which bypasses RLS. Enabling
-- RLS with no policies means anon/authenticated keys get nothing.
alter table scheduled_sms enable row level security;
