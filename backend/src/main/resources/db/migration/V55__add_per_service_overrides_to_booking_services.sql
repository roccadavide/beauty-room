ALTER TABLE booking_services
    ADD COLUMN override_duration_min INTEGER,
    ADD COLUMN price_override DECIMAL(10, 2);
