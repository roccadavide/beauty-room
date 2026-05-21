-- V59 — Multi-line composition for in-person packages (ClientPackageAssignment).
-- Adds the items child table, three new columns on the parent, and backfills
-- one item per existing assignment so the invariant
-- "every package has >= 1 composition item" holds after this migration.
-- Fully idempotent: every statement is guarded with IF NOT EXISTS or WHERE NOT EXISTS.

-- 1. Child table for composition items ------------------------------------------------
CREATE TABLE IF NOT EXISTS client_package_assignment_items (
    id                UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id     UUID         NOT NULL REFERENCES client_package_assignments(id) ON DELETE CASCADE,
    service_id        UUID         REFERENCES services(service_id)        ON DELETE SET NULL,
    service_option_id UUID         REFERENCES service_options(option_id)  ON DELETE SET NULL,
    custom_name       VARCHAR(255),
    position          INTEGER      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cpa_items_assignment
    ON client_package_assignment_items (assignment_id);

CREATE INDEX IF NOT EXISTS idx_cpa_items_service
    ON client_package_assignment_items (service_id)
    WHERE service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cpa_items_option
    ON client_package_assignment_items (service_option_id)
    WHERE service_option_id IS NOT NULL;

-- 2. New columns on the parent --------------------------------------------------------
ALTER TABLE client_package_assignments
    ADD COLUMN IF NOT EXISTS session_duration_min INTEGER;

ALTER TABLE client_package_assignments
    ADD COLUMN IF NOT EXISTS paid_upfront BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE client_package_assignments
    ADD COLUMN IF NOT EXISTS start_session INTEGER NOT NULL DEFAULT 1;

-- 3. Backfill: one composition item per existing assignment (idempotent) -------------
-- For every assignment that has no items yet, insert exactly one row mirroring the
-- legacy single-option / single-service / custom-name fields. This preserves the
-- invariant that every package has >= 1 composition item AND that every item
-- renders as something readable (no all-NULL degenerate rows): when neither a
-- catalog reference nor a custom_package_name exists, the item falls back to
-- 'Pacchetto'.
INSERT INTO client_package_assignment_items
    (assignment_id, service_id, service_option_id, custom_name, position)
SELECT
    cpa.id,
    cpa.service_id,
    cpa.service_option_id,
    CASE
        WHEN cpa.service_id IS NULL AND cpa.service_option_id IS NULL
            THEN COALESCE(NULLIF(TRIM(cpa.custom_package_name), ''), 'Pacchetto')
        ELSE NULL
    END,
    0
FROM client_package_assignments cpa
WHERE NOT EXISTS (
    SELECT 1 FROM client_package_assignment_items i
    WHERE i.assignment_id = cpa.id
);
