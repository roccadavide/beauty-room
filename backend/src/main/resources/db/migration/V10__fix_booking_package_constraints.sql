-- ============================================================================
-- V10: Hardening PackageCredit
-- 1) Rimozione UNIQUE su bookings.package_credit_id
-- 2) Unique parziale robusto su package_credits (ACTIVE)
-- ============================================================================

-- 1. Rimuove l'unico vincolo UNIQUE noto sulla colonna package_credit_id
ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS uk9sjjjt7i5qkspd8wls8t9btp7;

-- Nel dubbio, rimuove anche un eventuale unique index autonomo
DROP INDEX IF EXISTS bookings_package_credit_id_key;

-- 2. Unique parziale: un solo PackageCredit ACTIVE per (email, option)
--    Usa lower(customer_email) per robustezza case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pkg_active_unique
    ON public.package_credits (lower(customer_email), service_option_id)
    WHERE status = 'ACTIVE';

