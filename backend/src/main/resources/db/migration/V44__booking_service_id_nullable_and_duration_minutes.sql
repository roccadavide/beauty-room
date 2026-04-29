-- V44: Support custom-only bookings (no catalog service) and store total duration.
--
-- 1. service_id is made nullable so bookings with only a custom service
--    (is_custom_service = TRUE) don't require a catalog service FK.
--    Existing rows are unaffected (they already have a non-null service_id).
--
-- 2. duration_minutes stores the pre-computed total duration for multi-service
--    bookings (sum of all service durations + custom service duration).
--    Null on existing rows — the application falls back to service.durationMin.
--
-- Rollback:
--   ALTER TABLE bookings ALTER COLUMN service_id SET NOT NULL;
--   ALTER TABLE bookings DROP COLUMN IF EXISTS duration_minutes;

ALTER TABLE bookings
    ALTER COLUMN service_id DROP NOT NULL;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
