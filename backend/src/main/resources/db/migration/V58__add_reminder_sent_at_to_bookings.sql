-- Aggiunge reminder_sent_at a bookings: traccia quando l'admin ha inviato
-- il promemoria WhatsApp alla cliente. NULL = promemoria non ancora inviato.
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;
