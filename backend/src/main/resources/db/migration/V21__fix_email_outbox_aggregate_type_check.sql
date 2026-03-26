-- Allows WAITLIST aggregate type for waitlist notification outbox rows.
ALTER TABLE email_outbox
    DROP CONSTRAINT IF EXISTS email_outbox_aggregate_type_check;

ALTER TABLE email_outbox
    ADD CONSTRAINT email_outbox_aggregate_type_check
    CHECK (aggregate_type IN (
        'BOOKING',
        'ORDER',
        'WAITLIST'
    ));
