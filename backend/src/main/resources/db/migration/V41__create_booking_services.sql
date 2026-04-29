-- V41: booking_services — enables multi-service bookings
--
-- The bookings table has a single service_id FK (the primary/first service).
-- This additive table stores additional services for multi-service bookings.
--
-- Migration strategy (backwards compatible):
--   - Existing bookings keep their service_id FK untouched.
--   - New multi-service bookings: the primary service goes in bookings.service_id
--     AND all services (including the primary) are listed in booking_services.
--   - Single-service bookings created after this migration do NOT need a row here
--     (the FK on bookings is sufficient).
--
-- Application layer responsibility:
--   - Availability calculation must chain consecutive slots for all services.
--   - Total duration = sum of all service durations in booking_services.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_bsvc_service;
--   DROP TABLE IF EXISTS booking_services;

CREATE TABLE booking_services (
    id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(service_id),
    -- Preserve order of services within the booking (1 = first, 2 = second, …)
    sort_order INTEGER NOT NULL DEFAULT 1,
    UNIQUE (booking_id, service_id)
);

-- Lookup all bookings that include a specific service
CREATE INDEX idx_bsvc_service ON booking_services (service_id);
