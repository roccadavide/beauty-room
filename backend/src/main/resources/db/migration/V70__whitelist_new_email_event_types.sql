-- V70: whitelist the 4 email event types added by the email merge in the
--      email_outbox_event_type_check CHECK constraint (last defined in V36).
--
-- BOOKING_REFUND_CONFIRMED, ORDER_REFUND_CONFIRMED, BOOKING_RESCHEDULED and
-- BOOKING_CANCELLED were added to EmailEventType but never to this constraint,
-- so enqueuing any of them violated the CHECK at commit and rolled back the
-- whole move/cancel/refund transaction. Idempotent pattern mirrors V34/V36.
-- aggregate_type is left untouched: all 4 reuse already-whitelisted BOOKING/ORDER.

ALTER TABLE email_outbox
    DROP CONSTRAINT IF EXISTS email_outbox_event_type_check;

ALTER TABLE email_outbox
    ADD CONSTRAINT email_outbox_event_type_check
    CHECK (event_type IN (
        -- 9 original, as last defined in V36
        'BOOKING_CONFIRMED',
        'BOOKING_REMINDER_24H',
        'ORDER_PAID',
        'PAID_CONFLICT',
        'BOOKING_REFUNDED',
        'REVIEW_REQUEST',
        'WAITLIST_SLOT_AVAILABLE',
        'USER_REGISTERED',
        'WISHLIST_BACK_IN_STOCK',
        -- 4 added by the email merge
        'BOOKING_REFUND_CONFIRMED',
        'ORDER_REFUND_CONFIRMED',
        'BOOKING_RESCHEDULED',
        'BOOKING_CANCELLED'
    ));
