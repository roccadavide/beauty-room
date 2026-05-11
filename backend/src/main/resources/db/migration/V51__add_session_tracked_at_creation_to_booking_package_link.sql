ALTER TABLE booking_package_link
    ADD COLUMN IF NOT EXISTS session_tracked_at_creation BOOLEAN NOT NULL DEFAULT FALSE;
