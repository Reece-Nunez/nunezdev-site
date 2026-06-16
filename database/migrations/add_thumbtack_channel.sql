-- Phase C: allow a 'thumbtack' channel on inbox conversations + messages.
--
-- The inbox was built for email/sms; Thumbtack customer messages are a third
-- channel routed differently (no Reply-To, no E.164 — see thumbtackInbox.ts).
-- Widen the CHECK constraints to admit it. Idempotent: drop-if-exists then add.

alter table conversations drop constraint if exists conversations_channel_check;
alter table conversations add constraint conversations_channel_check
  check (channel in ('email', 'sms', 'thumbtack'));

alter table messages drop constraint if exists messages_channel_check;
alter table messages add constraint messages_channel_check
  check (channel in ('email', 'sms', 'thumbtack'));
