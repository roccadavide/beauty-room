-- V40: booking_package_link — links a booking to one session of a client_package_assignment
--
-- One row per (booking, package_assignment) pair.
-- session_number records which session of the package this booking represents
-- (e.g. session_number = 3 means "this was the 3rd visit of the 10-session course").
--
-- When the booking transitions to COMPLETED, the application layer should
-- increment client_package_assignments.sessions_used accordingly.
--
-- The UNIQUE constraint on booking_id prevents a booking from being counted
-- twice against the same package.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_bpl_assignment;
--   DROP TABLE IF EXISTS booking_package_link;

CREATE TABLE booking_package_link (
    id                           UUID      NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id                   UUID      NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    client_package_assignment_id UUID      NOT NULL REFERENCES client_package_assignments(id),
    session_number               INTEGER   NOT NULL,
    created_at                   TIMESTAMP NOT NULL DEFAULT NOW(),
    -- A booking can only be linked once per package assignment
    UNIQUE (booking_id, client_package_assignment_id)
);

-- Lookup all bookings for a given package assignment (to show session history)
CREATE INDEX idx_bpl_assignment
    ON booking_package_link (client_package_assignment_id);
