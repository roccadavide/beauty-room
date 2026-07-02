-- ============================================================
-- V83 – Multi-staff (prompt 01): staff_id columns + backfill to the owner
-- ------------------------------------------------------------
-- Adds a nullable staff_id FK to bookings, personal_appointments,
-- booking_sales and closures, then backfills the first THREE to the single
-- staff row seeded by V82. closures.staff_id intentionally stays NULL:
-- NULL = salon-wide closure; a non-NULL value (from prompt 03 onward) will
-- mean a per-staff absence.
--
-- Columns stay nullable here; bookings/personal_appointments get SET NOT
-- NULL in the final hardening migration (prompt 13) once every write path
-- has been staff-aware for the whole rollout. booking_sales.staff_id stays
-- nullable by design (NULL = unattributed sale).
--
-- Guard (V73/V80 style): the backfill ABORTS LOUDLY unless staff_members
-- contains exactly one row (the V82 seed) — running this with 2+ staff
-- would silently attribute the whole history to an arbitrary person.
-- Idempotent: the UPDATEs only touch staff_id IS NULL rows. Postgres wraps
-- the migration in one transaction — any failure rolls back everything.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_bookings_staff_start;
--   DROP INDEX IF EXISTS idx_personal_appts_staff_date;
--   DROP INDEX IF EXISTS idx_booking_sales_staff;
--   ALTER TABLE public.bookings              DROP COLUMN IF EXISTS staff_id;
--   ALTER TABLE public.personal_appointments DROP COLUMN IF EXISTS staff_id;
--   ALTER TABLE public.booking_sales         DROP COLUMN IF EXISTS staff_id;
--   ALTER TABLE public.closures              DROP COLUMN IF EXISTS staff_id;
-- ============================================================

-- 1. Nullable FK columns.
ALTER TABLE public.bookings              ADD COLUMN staff_id UUID REFERENCES public.staff_members (id);
ALTER TABLE public.personal_appointments ADD COLUMN staff_id UUID REFERENCES public.staff_members (id);
ALTER TABLE public.booking_sales         ADD COLUMN staff_id UUID REFERENCES public.staff_members (id);
ALTER TABLE public.closures              ADD COLUMN staff_id UUID REFERENCES public.staff_members (id);

-- 2. Backfill history to the owner (guarded, idempotent).
DO $$
DECLARE
    staff_count integer;
    v_staff_id  uuid;
BEGIN
    SELECT count(*) INTO staff_count FROM public.staff_members;
    IF staff_count <> 1 THEN
        RAISE EXCEPTION
            'V83 aborted: expected exactly one staff_members row (the V82 seed), found %. Backfill target is ambiguous.',
            staff_count;
    END IF;

    SELECT id INTO v_staff_id FROM public.staff_members;

    UPDATE public.bookings              SET staff_id = v_staff_id WHERE staff_id IS NULL;
    UPDATE public.personal_appointments SET staff_id = v_staff_id WHERE staff_id IS NULL;
    UPDATE public.booking_sales         SET staff_id = v_staff_id WHERE staff_id IS NULL;
    -- closures: NOT backfilled — NULL means salon-wide (see header).
END $$;

-- 3. Indexes for the per-staff read paths (prompts 06+).
CREATE INDEX IF NOT EXISTS idx_bookings_staff_start      ON public.bookings (staff_id, start_time);
CREATE INDEX IF NOT EXISTS idx_personal_appts_staff_date ON public.personal_appointments (staff_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_booking_sales_staff       ON public.booking_sales (staff_id);
