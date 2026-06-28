-- Trace an invoice back to the proposal it was converted from, and record the
-- conversion on the client's activity timeline.
--
-- 1. invoices.source_proposal_id: a nullable back-link. Until now the link was
--    one-way (proposals.converted_to_invoice_id), so from an invoice you could
--    not tell it began life as a proposal. ON DELETE SET NULL so deleting a
--    proposal never deletes the invoice it produced.
-- 2. client_activity_log.activity_type: widen the CHECK by one value
--    ('proposal_converted') so the conversion shows up in the client history.
--
-- Applied to the NunezDev Supabase project on 2026-06-27.

alter table public.invoices
  add column if not exists source_proposal_id uuid
  references public.proposals(id) on delete set null;

alter table public.client_activity_log drop constraint client_activity_log_activity_type_check;

alter table public.client_activity_log add constraint client_activity_log_activity_type_check
  check (activity_type = any (array[
    'invoice_viewed'::text,
    'invoice_downloaded'::text,
    'contract_signed'::text,
    'payment_initiated'::text,
    'payment_completed'::text,
    'payment_failed'::text,
    'payment_link_clicked'::text,
    'email_opened'::text,
    'email_sent'::text,
    'recurring_invoice_sent'::text,
    'proposal_converted'::text
  ]));
