-- Add a direct `service_id` FK to client_package_assignments.
-- This decouples the package from serviceOption, so packages for services
-- without options (e.g. Laminazione ciglia) can still reference a service.

-- 1. Add the column (nullable; existing rows are backfilled below)
ALTER TABLE client_package_assignments
ADD COLUMN IF NOT EXISTS service_id UUID;

-- 2. FK constraint (ON DELETE SET NULL so a service delete does not cascade)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cpa_service'
    ) THEN
        ALTER TABLE client_package_assignments
        ADD CONSTRAINT fk_cpa_service
        FOREIGN KEY (service_id) REFERENCES services(service_id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Backfill from serviceOption.service for packages that have an option
UPDATE client_package_assignments cpa
SET service_id = so.service_id
FROM service_options so
WHERE cpa.service_option_id = so.option_id
  AND cpa.service_id IS NULL;

-- 4. Backfill from custom_package_name title match for legacy option-less packages
-- (e.g. "Laminazione ciglia" created before this fix). DISTINCT ON guarantees
-- one match per package even if multiple services share a title.
UPDATE client_package_assignments cpa
SET service_id = sub.matched_service_id
FROM (
    SELECT DISTINCT ON (cpa2.id)
        cpa2.id AS cpa_id,
        s.service_id AS matched_service_id
    FROM client_package_assignments cpa2
    JOIN services s ON LOWER(TRIM(s.title)) = LOWER(TRIM(cpa2.custom_package_name))
    WHERE cpa2.service_id IS NULL
      AND cpa2.custom_package_name IS NOT NULL
      AND cpa2.custom_package_name <> ''
    ORDER BY cpa2.id, s.service_id
) sub
WHERE cpa.id = sub.cpa_id;

-- 5. Index for fast joins
CREATE INDEX IF NOT EXISTS idx_cpa_service ON client_package_assignments(service_id);
