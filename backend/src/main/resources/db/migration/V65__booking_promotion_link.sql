-- V65 — booking_promotion_link (+ _item) and promo-product tagging on booking_sales.
--
-- Infrastructure ONLY (08.1): brings Promotions into the agenda data-model the same
-- way Packages already attach, WITHOUT any runtime behavior change. No existing flow
-- reads these structures yet — wiring lands in 08.2 (agenda) and 08.3 (online checkout).
--
-- Design — FROZEN SNAPSHOT:
--   When a promotion is attached to an appointment its contents and prices are frozen
--   at attach time. Later edits / archival / deletion of the promotion must NOT change
--   what the appointment shows or charges ("bought under those terms"). Therefore the
--   link stores snapshot copies of title, discount, per-line names and per-line prices,
--   and never reads them live. The live FK to promotions is kept only for traceability
--   and is nullable: it survives promotion deletion via ON DELETE SET NULL.
--
--   booking_promotion_link        — parent link (booking <-> one promotion) + frozen totals.
--   booking_promotion_link_item   — snapshotted promo SERVICES, ordered by position.
--   booking_sales (+2 columns)    — promo PRODUCTS reuse the existing sale row; a sale is
--                                   tagged with the owning link and carries its frozen
--                                   pre-discount unit price for the struck-through display.
--
-- Timestamps use `timestamp(6) without time zone` to match the codebase convention
-- (LocalDateTime + ddl-auto=validate), NOT timestamptz. Money is DECIMAL(10,2).
-- FK references use the real UUID PKs: bookings(booking_id), promotions(promotion_id),
-- services(service_id), service_options(option_id).
-- booking_id mirrors booking_package_link.booking_id: ON DELETE CASCADE.
--
-- Fully idempotent (IF NOT EXISTS guards).
--
-- Rollback:
--   ALTER TABLE booking_sales DROP COLUMN IF EXISTS original_unit_price;
--   ALTER TABLE booking_sales DROP COLUMN IF EXISTS promotion_link_id;
--   DROP INDEX IF EXISTS idx_bpromo_item_link;
--   DROP TABLE IF EXISTS booking_promotion_link_item;
--   DROP INDEX IF EXISTS idx_bpromo_booking;
--   DROP TABLE IF EXISTS booking_promotion_link;

-- 1. Parent link (booking <-> one promotion) + frozen bundle totals -------------------
CREATE TABLE IF NOT EXISTS booking_promotion_link (
    id                        UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id                UUID          NOT NULL REFERENCES bookings(booking_id)     ON DELETE CASCADE,
    promotion_id              UUID                   REFERENCES promotions(promotion_id) ON DELETE SET NULL,
    promotion_title_snapshot  VARCHAR(255)  NOT NULL,
    discount_type_snapshot    VARCHAR(20)   NOT NULL,
    discount_value_snapshot   DECIMAL(10, 2),
    total_original_snapshot   DECIMAL(10, 2) NOT NULL,
    total_discounted_snapshot DECIMAL(10, 2) NOT NULL,
    applied_while_active      BOOLEAN       NOT NULL,
    paid                      BOOLEAN       NOT NULL DEFAULT false,
    linked_at                 TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    -- A booking can only be linked once per promotion (NULL promotion_id rows are
    -- considered distinct by Postgres, so deleted-promo links never collide).
    CONSTRAINT uq_booking_promo_link UNIQUE (booking_id, promotion_id)
);

-- Lookup all promotion links for a booking (agenda render in 08.2).
CREATE INDEX IF NOT EXISTS idx_bpromo_booking
    ON booking_promotion_link (booking_id);

-- 2. Snapshotted promo SERVICES (ordered composition lines) ---------------------------
CREATE TABLE IF NOT EXISTS booking_promotion_link_item (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    promotion_link_id        UUID          NOT NULL REFERENCES booking_promotion_link(id) ON DELETE CASCADE,
    position                 INTEGER       NOT NULL,
    service_id               UUID                   REFERENCES services(service_id)        ON DELETE SET NULL,
    service_option_id        UUID                   REFERENCES service_options(option_id)  ON DELETE SET NULL,
    name_snapshot            VARCHAR(255)  NOT NULL,
    original_price_snapshot  DECIMAL(10, 2) NOT NULL,
    discounted_price_snapshot DECIMAL(10, 2) NOT NULL,
    duration_min_snapshot    INTEGER
);

-- Lookup all items for a link (agenda render in 08.2).
CREATE INDEX IF NOT EXISTS idx_bpromo_item_link
    ON booking_promotion_link_item (promotion_link_id);

-- 3. Promo PRODUCTS reuse booking_sales — tag + frozen pre-discount unit price ---------
-- promotion_link_id NULL  = standalone free sale (unchanged behavior, moves no stock).
-- original_unit_price NULL = free sale (unit_price is already the full price there).
ALTER TABLE booking_sales
    ADD COLUMN IF NOT EXISTS promotion_link_id UUID REFERENCES booking_promotion_link(id) ON DELETE SET NULL;

ALTER TABLE booking_sales
    ADD COLUMN IF NOT EXISTS original_unit_price DECIMAL(10, 2);
