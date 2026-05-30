-- V64 — Recurring package templates + per-appointment custom total price.
--
-- Three concerns, one ship-once migration:
--   1. recurring_package_template (+ _item) — admin-saved reusable package
--      "recipes". A pure blueprint: NO client, NO sessions, NO paid/status.
--      Applied in the New Appointment Drawer by expanding into normal
--      booking_services / booking_package_link rows, then forgotten. It has
--      NO query path from the public Occasioni page (ServiceOption.isPackage),
--      so a template can never leak to the public catalog.
--   2. bookings.custom_total_price — one override price for the WHOLE
--      appointment (a "bundle"), mirroring the existing custom duration override.
--      NULL = no override (per-line prices win, as today).
--   3. Partial indexes on the per-line paid flags so the derived "arretrati"
--      query (unpaid lines on COMPLETED bookings) stays index-backed.
--
-- Timestamps use `timestamp(6) without time zone` to match the codebase
-- convention (LocalDateTime + ddl-auto=validate), NOT timestamptz.
-- FK references use the real UUID PKs: services(service_id), service_options(option_id).
--
-- Fully idempotent (IF NOT EXISTS guards).
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_bpl_unpaid;
--   DROP INDEX IF EXISTS idx_bs_unpaid_completed;
--   ALTER TABLE bookings DROP COLUMN IF EXISTS custom_total_price;
--   DROP TABLE IF EXISTS recurring_package_template_item;
--   DROP TABLE IF EXISTS recurring_package_template;

-- 1. Recurring package template (parent "recipe") ------------------------------------
CREATE TABLE IF NOT EXISTS recurring_package_template (
    id                   UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name                 TEXT         NOT NULL,
    default_price        DECIMAL(10, 2),
    default_duration_min INTEGER,
    notes                TEXT,
    created_at           TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    updated_at           TIMESTAMP(6) WITHOUT TIME ZONE,
    archived_at          TIMESTAMP(6) WITHOUT TIME ZONE
);

-- 2. Recurring package template items (ordered composition lines) ---------------------
CREATE TABLE IF NOT EXISTS recurring_package_template_item (
    id                    UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id           UUID         NOT NULL REFERENCES recurring_package_template(id) ON DELETE CASCADE,
    position              INTEGER      NOT NULL,
    service_id            UUID         REFERENCES services(service_id)       ON DELETE SET NULL,
    service_option_id     UUID         REFERENCES service_options(option_id) ON DELETE SET NULL,
    custom_name           VARCHAR(255),
    price_override        DECIMAL(10, 2),
    duration_override_min INTEGER,
    CONSTRAINT rpt_item_has_source CHECK (
        service_id IS NOT NULL OR service_option_id IS NOT NULL OR custom_name IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_rpt_item_template
    ON recurring_package_template_item (template_id);

-- Active templates picker lookup (archived templates excluded structurally).
CREATE INDEX IF NOT EXISTS idx_rpt_active
    ON recurring_package_template (name)
    WHERE archived_at IS NULL;

-- 3. Per-appointment custom total price (the "bundle" override) -----------------------
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS custom_total_price DECIMAL(10, 2);

-- 4. Partial indexes backing the derived "arretrati" EXISTS query ---------------------
-- Only unpaid lines are interesting; the partial predicate keeps the index tiny
-- and avoids a sequential scan as these tables grow.
CREATE INDEX IF NOT EXISTS idx_bs_unpaid_completed
    ON booking_services (booking_id)
    WHERE paid = false;

CREATE INDEX IF NOT EXISTS idx_bpl_unpaid
    ON booking_package_link (booking_id)
    WHERE paid = false;
