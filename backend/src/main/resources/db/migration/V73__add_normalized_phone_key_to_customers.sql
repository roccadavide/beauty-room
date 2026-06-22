-- ============================================================
-- V73 – Normalized phone key for robust customer deduplication
-- ------------------------------------------------------------
-- Adds a SEPARATE digits-only key column (phone_normalized) and moves the
-- unique phone index onto it, so two writes of the same number with different
-- spacing ("347 123 4567" vs "3471234567") resolve to ONE customer.
--
-- The human-readable `phone` column is left untouched (display stays verbatim).
-- Normalization form = regexp_replace(phone,'[^0-9]','','g') — the SAME form the
-- booking-side history/arretrati SQL already uses, so zero blast radius there.
--
-- Strict order (MANDATORY): add column -> backfill -> duplicate guard ->
-- drop old index -> create new index. Postgres wraps this migration in one
-- transaction, so any failure (incl. the guard's RAISE) rolls the WHOLE thing
-- back — never half-applied.
--
-- PRECONDITION (run by the developer BEFORE deploying this migration):
--   SELECT regexp_replace(phone,'[^0-9]','','g') AS norm, count(*) AS n,
--          array_agg(customer_id) AS ids
--   FROM public.customers
--   WHERE phone IS NOT NULL AND regexp_replace(phone,'[^0-9]','','g') <> ''
--   GROUP BY 1 HAVING count(*) > 1;
--   -> must return ZERO rows. Step 3 below is the defensive net if it didn't.
-- ============================================================

-- 1. Add the nullable normalized key column.
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- 2. Backfill from the existing display phone (digits-only; empty -> NULL so it
--    stays out of the partial unique index).
UPDATE public.customers
   SET phone_normalized = NULLIF(regexp_replace(phone, '[^0-9]', '', 'g'), '')
 WHERE phone IS NOT NULL;

-- 3. Defensive duplicate guard — abort loudly (rolls back the whole migration)
--    rather than crashing on the unique-index creation if a duplicate slipped
--    past the precondition check.
DO $$
DECLARE
    dup_groups integer;
BEGIN
    SELECT count(*) INTO dup_groups
    FROM (
        SELECT phone_normalized
        FROM public.customers
        WHERE phone_normalized IS NOT NULL
        GROUP BY phone_normalized
        HAVING count(*) > 1
    ) d;

    IF dup_groups > 0 THEN
        RAISE EXCEPTION
            'V73 aborted: % normalized-phone duplicate group(s) found in customers. '
            'Resolve duplicates before applying (see precondition query in this file).',
            dup_groups;
    END IF;
END $$;

-- 4. Drop the old raw-phone unique index (V11__create_customers.sql:20-22).
DROP INDEX IF EXISTS ux_customer_phone;

-- 5. Recreate it on the normalized key (partial: only enforced when present).
CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_phone
    ON public.customers (phone_normalized)
    WHERE phone_normalized IS NOT NULL;
