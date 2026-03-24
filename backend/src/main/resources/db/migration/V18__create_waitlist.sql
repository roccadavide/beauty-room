CREATE TABLE waitlist_entries (
    id                UUID          NOT NULL DEFAULT gen_random_uuid(),
    service_id        UUID          NOT NULL,
    requested_date    DATE          NOT NULL,
    requested_time    TIME          NOT NULL,
    customer_name     VARCHAR(100)  NOT NULL,
    customer_email    VARCHAR(100)  NOT NULL,
    customer_phone    VARCHAR(20)   NOT NULL,
    status            VARCHAR(20)   NOT NULL DEFAULT 'WAITING',
    notified_at       TIMESTAMP,
    token             VARCHAR(80)   UNIQUE,
    token_expires_at  TIMESTAMP,
    created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_waitlist PRIMARY KEY (id),
    CONSTRAINT fk_waitlist_service
        FOREIGN KEY (service_id) REFERENCES service_items(service_id) ON DELETE CASCADE,
    CONSTRAINT chk_waitlist_status
        CHECK (status IN ('WAITING','NOTIFIED','BOOKED','EXPIRED'))
);

CREATE INDEX idx_waitlist_slot    ON waitlist_entries (service_id, requested_date, requested_time);
CREATE INDEX idx_waitlist_status  ON waitlist_entries (status) WHERE status = 'WAITING';
CREATE INDEX idx_waitlist_token   ON waitlist_entries (token)  WHERE token IS NOT NULL;
