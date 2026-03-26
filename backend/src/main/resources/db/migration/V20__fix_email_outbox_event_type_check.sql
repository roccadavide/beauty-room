-- Rimuove il vecchio check constraint e lo ricrea includendo WAITLIST_SLOT_AVAILABLE.
-- Mantiene anche tutti i valori attualmente presenti nel DB di sviluppo.
ALTER TABLE email_outbox
    DROP CONSTRAINT IF EXISTS email_outbox_event_type_check;

ALTER TABLE email_outbox
    ADD CONSTRAINT email_outbox_event_type_check
    CHECK (event_type IN (
        'BOOKING_CONFIRMED',
        'BOOKING_REMINDER_24H',
        'ORDER_PAID',
        'WAITLIST_SLOT_AVAILABLE'
    ));
