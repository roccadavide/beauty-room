-- V54: add option_id to booking_services
--
-- Allows tracking which ServiceOption was selected for each individual
-- service entry in a multi-service booking.
-- NULL = no option selected for this service entry (backwards compatible).
--
-- The booking-level service_option_id FK is kept for single-service
-- backward compat; this column extends tracking to every row.

ALTER TABLE booking_services
    ADD COLUMN option_id UUID NULL
        REFERENCES service_options(option_id) ON DELETE SET NULL;

COMMENT ON COLUMN booking_services.option_id IS
    'Service option for this specific entry. NULL if no option selected. ON DELETE SET NULL preserves history.';
