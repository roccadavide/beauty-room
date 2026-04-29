-- V37: personal_appointments — Michela's personal calendar events
-- These are NOT client bookings: no payment, no Stripe, no service catalogue link.
-- Examples: "Psicologa 14:00", "Pole dance 18:30", "Riunione fornitore"
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_personal_appt_date;
--   DROP TABLE IF EXISTS personal_appointments;

CREATE TABLE personal_appointments (
    id               UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title            VARCHAR(255) NOT NULL,
    notes            TEXT,
    appointment_date DATE         NOT NULL,
    start_time       TIME         NOT NULL,
    duration_minutes INTEGER      NOT NULL DEFAULT 60,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP
);

-- Fast lookup by date (agenda daily/weekly view)
CREATE INDEX idx_personal_appt_date ON personal_appointments (appointment_date);
