-- =============================================================================
-- V9: sistema pacchetti — expiry_date + stati COMPLETED / EXPIRED
-- =============================================================================

-- 1. Nuova colonna expiry_date
--    Per i record esistenti viene calcolata come purchased_at + 24 mesi.
ALTER TABLE public.package_credits
    ADD COLUMN IF NOT EXISTS expiry_date timestamp(6) WITHOUT TIME ZONE;

UPDATE public.package_credits
   SET expiry_date = purchased_at + INTERVAL '24 months'
 WHERE expiry_date IS NULL;

ALTER TABLE public.package_credits
    ALTER COLUMN expiry_date SET NOT NULL;

-- 2. Aggiorna il CHECK constraint per includere COMPLETED e EXPIRED
ALTER TABLE public.package_credits
    DROP CONSTRAINT IF EXISTS package_credits_status_check;

ALTER TABLE public.package_credits
    ADD CONSTRAINT package_credits_status_check
        CHECK (status::text = ANY (ARRAY[
            'ACTIVE'::text,
            'COMPLETED'::text,
            'EXPIRED'::text,
            'EXHAUSTED'::text,   -- legacy
            'CANCELLED'::text    -- legacy
        ]));

-- 3. Indice su expiry_date per le query dello scheduler
CREATE INDEX IF NOT EXISTS idx_pkg_expiry
    ON public.package_credits (expiry_date)
    WHERE status = 'ACTIVE';
