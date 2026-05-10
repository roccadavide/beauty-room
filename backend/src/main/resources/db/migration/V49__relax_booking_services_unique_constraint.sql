-- Allow multiple options of the same service within a single booking.
-- Row uniqueness is already guaranteed by the PK (id UUID).
ALTER TABLE booking_services
    DROP CONSTRAINT IF EXISTS booking_services_booking_id_service_id_key;
