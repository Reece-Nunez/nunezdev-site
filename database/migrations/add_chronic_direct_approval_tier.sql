-- Phase 4 of the SMS follow-up work: chronic non-payer detection.
--
-- Adds a second approval-gated tier, 'chronic_direct', to the approval queue.
-- A chronic non-payer (client with an active recurring invoice who is 3+ billing
-- cycles behind) gets a blunter, client-level "you are seriously past due" text
-- queued for owner approval instead of the soft auto-ladder. Same owner-approval
-- gate as 'shutdown' — nothing sends without a click.
--
-- Applied to the NunezDev Supabase project on 2026-07-07.

ALTER TABLE pending_sms_approvals DROP CONSTRAINT pending_sms_approvals_tier_check;
ALTER TABLE pending_sms_approvals ADD CONSTRAINT pending_sms_approvals_tier_check
  CHECK (tier IN ('shutdown', 'chronic_direct'));
