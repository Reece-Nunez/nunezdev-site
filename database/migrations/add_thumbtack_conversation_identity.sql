-- Phase C (cont.): give conversations an external-id identity for channels that
-- have neither email nor phone.
--
-- A real Thumbtack message payload (MessageCreatedV4) carries no email/phone —
-- only a negotiationID (the thread) and a customer displayName. The inbox's
-- identity constraint required email OR phone, which a Thumbtack thread can't
-- satisfy. Add contact_external_id (the Thumbtack negotiationID) and widen the
-- constraint to accept it.

alter table conversations add column if not exists contact_external_id text;

alter table conversations drop constraint if exists conversations_identity_present;
alter table conversations add constraint conversations_identity_present
  check (
    contact_email is not null
    or contact_phone is not null
    or contact_external_id is not null
  );

-- Thread lookup for external-id channels (Thumbtack keys on negotiationID).
create index if not exists idx_conversations_external
  on conversations(channel, contact_external_id);
