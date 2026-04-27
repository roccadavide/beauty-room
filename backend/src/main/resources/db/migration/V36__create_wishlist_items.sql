-- V36: tabella wishlist_items + aggiornamento constraint email_outbox

CREATE TABLE wishlist_items (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        REFERENCES users(user_id) ON DELETE CASCADE,
    item_type   VARCHAR(20) NOT NULL CHECK (item_type IN ('SERVICE','PRODUCT','PROMOTION','PACKAGE')),
    item_id     UUID        NOT NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX idx_wishlist_user ON wishlist_items(user_id);
CREATE INDEX idx_wishlist_item ON wishlist_items(item_type, item_id);

-- Aggiorna il check constraint su email_outbox per includere WISHLIST_BACK_IN_STOCK
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
        'USER_REGISTERED',
        'WISHLIST_BACK_IN_STOCK'
    ));

-- Aggiorna il check constraint su email_outbox per includere WISHLIST_ITEM
ALTER TABLE email_outbox
    DROP CONSTRAINT IF EXISTS email_outbox_aggregate_type_check;

ALTER TABLE email_outbox
    ADD CONSTRAINT email_outbox_aggregate_type_check
    CHECK (aggregate_type IN (
        'BOOKING',
        'ORDER',
        'WAITLIST',
        'USER',
        'WISHLIST_ITEM'
    ));
