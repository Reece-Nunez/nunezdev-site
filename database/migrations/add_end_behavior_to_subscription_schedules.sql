-- Track what happens when a Subscription Schedule's last phase ends:
--   'release'  → converts to an ongoing Subscription (most common for retainers)
--   'cancel'   → stops billing entirely
--   'renew'    → restarts the schedule from the beginning
--
-- Without this, we can't tell from our mirror whether a schedule with a
-- bounded end_date will keep billing or stop, which matters for revenue
-- forecasting and UI messaging.

ALTER TABLE client_subscription_schedules
  ADD COLUMN IF NOT EXISTS end_behavior TEXT
  CHECK (end_behavior IS NULL OR end_behavior IN ('release', 'cancel', 'renew'));
