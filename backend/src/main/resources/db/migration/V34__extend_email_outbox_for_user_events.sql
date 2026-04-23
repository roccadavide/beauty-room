-- V34: estende email_outbox per eventi di tipo USER
--      Aggiunge USER_REGISTERED come event_type e USER come aggregate_type

ALTER TABLE email_outbox
    DROP CONSTRAINT IF EXISTS email_outbox_event_type_check;

ALTER TABLE email_outbox
    ADD CONSTRAINT email_outbox_event_type_check
    CHECK (event_type IN (
        'BOOKING_CONFIRMED',
        'BOOKING_REMINDER_24H',
        'ORDER_PAID',
        'PAID_CONFLICT',
        'BOOKING_REFUNDED',
        'REVIEW_REQUEST',
        'WAITLIST_SLOT_AVAILABLE',
        'USER_REGISTERED'
    ));

ALTER TABLE email_outbox
    DROP CONSTRAINT IF EXISTS email_outbox_aggregate_type_check;

ALTER TABLE email_outbox
    ADD CONSTRAINT email_outbox_aggregate_type_check
    CHECK (aggregate_type IN (
        'BOOKING',
        'ORDER',
        'WAITLIST',
        'USER'
    ));
