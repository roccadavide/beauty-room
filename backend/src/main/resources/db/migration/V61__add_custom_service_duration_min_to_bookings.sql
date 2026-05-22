-- V61: persist the per-custom-service duration on bookings.
--
-- Phase 5a added N package links per booking; that shift broke the previous
-- "infer custom duration from total minus catalog services" computation in
-- BookingService.buildAdminBookingCard — packages were never subtracted, so
-- the response inflated the custom duration to (pkg + custom). The frontend
-- reopened that inflated value, added it to the new total, and re-saved →
-- every edit doubled-or-worse the custom service duration (Phase 6e Bug 1).
--
-- The frontend has always sent customServiceDurationMinutes on create. This
-- column simply gives it a place to live so the response can return it
-- verbatim instead of computing.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS (Postgres ≥ 9.6). Null for legacy
-- rows; the builder falls back to the best-effort computation for them.
--
-- Rollback:
--   ALTER TABLE bookings DROP COLUMN IF EXISTS custom_service_duration_min;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS custom_service_duration_min INTEGER NULL;

COMMENT ON COLUMN bookings.custom_service_duration_min IS
    'Persisted per-custom-service duration (Phase 6e). NULL for rows created '
    'before V61 — the response builder falls back to (durationMinutes - sum of '
    'catalog service durations) for those. New rows always store the value '
    'the admin entered in the drawer.';
