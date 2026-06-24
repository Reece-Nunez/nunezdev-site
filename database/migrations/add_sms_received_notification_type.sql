-- Add 'sms_received' to the allowed notifications.type values so inbound SMS
-- can create an in-app bell notification (alongside the email alert).
--
-- The notifications.type column is guarded by a CHECK constraint; inserting a
-- value outside the list fails. This widens the list by one.
--
-- Applied to the NunezDev Supabase project on 2026-06-23.

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'invoice_sent'::text,
    'invoice_paid'::text,
    'invoice_partially_paid'::text,
    'payment_overdue'::text,
    'contract_signed'::text,
    'proposal_accepted'::text,
    'file_uploaded'::text,
    'sms_received'::text
  ]));
