CREATE TABLE booking_sales (
    id              UUID          NOT NULL DEFAULT gen_random_uuid(),
    booking_id      UUID          NOT NULL,
    product_id      UUID          NOT NULL,
    product_name    VARCHAR(200)  NOT NULL,
    quantity        INT           NOT NULL DEFAULT 1,
    unit_price      NUMERIC(10,2) NOT NULL,
    added_at        TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_booking_sales PRIMARY KEY (id),
    CONSTRAINT fk_booking_sales_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

CREATE INDEX idx_booking_sales_booking ON booking_sales (booking_id);
CREATE INDEX idx_booking_sales_product ON booking_sales (product_id);
