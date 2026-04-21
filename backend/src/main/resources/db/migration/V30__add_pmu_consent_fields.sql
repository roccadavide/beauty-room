-- V30: aggiunge tracciabilità firma consenso PMU
-- ──────────────────────────────────────────────────────────────────────
-- 1. Colonna consent_required su services (derivata da categoria PMU)
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS consent_required BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Colonne firma consenso su bookings
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS consent_signed     BOOLEAN   NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS consent_signed_at  TIMESTAMP;

-- 3. Imposta consent_required = TRUE per tutti i servizi PMU
--    (join a categories tramite category_id)
UPDATE services s
SET consent_required = TRUE
FROM categories c
WHERE s.category_id = c.category_id
  AND (
      LOWER(c.category_key) LIKE '%pmu%'
   OR LOWER(c.category_key) LIKE '%trucco%'
   OR LOWER(c.category_key) LIKE '%permanente%'
   OR LOWER(c.label)        LIKE '%trucco permanente%'
   OR LOWER(c.label)        LIKE '%pmu%'
  );
