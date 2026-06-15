-- Two-way inbox: unified email + SMS messaging (Phase 1 — data model)
--
-- Spine for the dashboard inbox. A `conversation` is a per-channel thread
-- with one contact; `messages` are the individual emails/texts in it.
--
-- Design notes:
--   * Threads are per-CHANNEL (an email thread and an SMS thread with the
--     same person are distinct rows). This keeps reply routing clean:
--     email replies route via a Reply-To of <conversation_id>@reply.nunezdev.com,
--     SMS threads route by phone number against our single Twilio number.
--   * The durable anchor is the raw channel identity (contact_email /
--     contact_phone), NOT the FK. `clients` has org_id but `leads` does not,
--     and inbound mail/SMS can arrive from someone not yet in either table,
--     so client_id/lead_id are nullable and resolved best-effort.
--   * RLS is fail-closed, service-role-only — matching the 385a1bd hardening.
--     All reads/writes go through server code using the service-role key.

-- ── conversations ───────────────────────────────────────────────────────
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,                                  -- populated when resolvable from a client; leads have none
  channel text not null check (channel in ('email', 'sms')),

  -- Channel identity (the durable anchor used to route inbound messages).
  -- Email convs carry contact_email; SMS convs carry contact_phone (E.164).
  contact_email text,
  contact_phone text,

  -- Best-effort resolution to a CRM record. on delete set null so deleting a
  -- client/lead doesn't destroy the message history (revenue/audit safety,
  -- same rationale as harden_client_subscriptions.sql).
  client_id uuid references clients(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,

  contact_name text,                            -- snapshot for display when no FK resolves
  subject text,                                 -- email thread subject (null for SMS)

  status text not null default 'open' check (status in ('open', 'archived', 'spam')),
  unread boolean not null default false,        -- true when the latest inbound message is unseen

  -- Denormalized tail of the thread, maintained by trigger below, so the
  -- inbox list renders without an N+1 join into messages.
  last_message_at timestamptz,
  last_message_preview text,
  last_direction text check (last_direction in ('inbound', 'outbound')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Every conversation must have at least one way to address the contact.
  constraint conversations_identity_present
    check (contact_email is not null or contact_phone is not null)
);

create index if not exists idx_conversations_phone on conversations(channel, contact_phone);
create index if not exists idx_conversations_email on conversations(channel, contact_email);
create index if not exists idx_conversations_client on conversations(client_id);
create index if not exists idx_conversations_lead on conversations(lead_id);
-- Inbox list ordering: most-recent-first within a status bucket.
create index if not exists idx_conversations_inbox on conversations(status, last_message_at desc);

-- ── messages ─────────────────────────────────────────────────────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,

  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null check (channel in ('email', 'sms')),

  from_address text not null,                   -- email address or E.164 phone
  to_address text not null,
  subject text,                                 -- email only
  body_text text,
  body_html text,                               -- email only

  provider text check (provider in ('resend', 'twilio')),
  provider_id text,                             -- Resend email id / Twilio SID / inbound id
  status text not null default 'sent'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'received')),
  error text,                                   -- failure reason when status = 'failed'

  sent_by uuid,                                 -- operator who sent it; null for inbound
  attachments jsonb not null default '[]',

  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
-- Idempotency: a provider webhook retry (Twilio/Resend redeliver on timeout)
-- must not insert a duplicate. Unique on provider_id where present.
create unique index if not exists idx_messages_provider_id
  on messages(provider_id) where provider_id is not null;

-- ── triggers ─────────────────────────────────────────────────────────────
-- Keep conversations.updated_at fresh on direct edits (status, read state).
create or replace function update_conversations_updated_at()
returns trigger
language plpgsql
set search_path = ''  -- pin search_path: an unpinned one is hijackable (advisor 0011)
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_conversations_updated_at
  before update on conversations
  for each row
  execute function update_conversations_updated_at();

-- Denormalize the latest message onto its conversation. Centralizing this in
-- a trigger means the composer, the SMS webhook, and the email webhook all
-- get consistent thread metadata without each remembering to update it.
create or replace function bump_conversation_on_message()
returns trigger
language plpgsql
set search_path = ''  -- pin search_path (advisor 0011); table refs must be schema-qualified
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      last_message_preview = left(coalesce(new.body_text, ''), 200),
      last_direction = new.direction,
      -- Inbound marks the thread unread; an outbound reply clears it.
      unread = (new.direction = 'inbound'),
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger trg_messages_bump_conversation
  after insert on messages
  for each row
  execute function bump_conversation_on_message();

-- ── RLS (fail-closed, service-role only) ─────────────────────────────────
alter table conversations enable row level security;
alter table messages enable row level security;

drop policy if exists "Service role full access on conversations" on conversations;
create policy "Service role full access on conversations"
  on conversations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role full access on messages" on messages;
create policy "Service role full access on messages"
  on messages for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
