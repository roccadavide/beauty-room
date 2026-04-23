-- V35: aggiunge is_no_show alla tabella bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_no_show BOOLEAN NOT NULL DEFAULT FALSE;
