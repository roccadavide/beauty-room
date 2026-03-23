CREATE TABLE stock_alerts (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL,
    email           VARCHAR(120) NOT NULL,
    customer_name   VARCHAR(120),
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    notified_at     TIMESTAMP,

    CONSTRAINT pk_stock_alerts PRIMARY KEY (id),
    CONSTRAINT uq_stock_alert_product_email UNIQUE (product_id, email)
);

CREATE INDEX idx_stock_alerts_product_notified
    ON stock_alerts (product_id, notified_at)
    WHERE notified_at IS NULL;
