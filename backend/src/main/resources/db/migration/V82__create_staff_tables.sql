-- ============================================================
-- V82 – Multi-staff (prompt 01): staff core tables + owner seed
-- ------------------------------------------------------------
-- Creates the inert staff data model: staff_members, staff_services
-- (qualification matrix), staff_working_hours (per-staff copy of the
-- working_hours shape). Then seeds ONE staff row for the owner (the single
-- ADMIN user), copies her weekly working_hours rows, and assigns her every
-- catalog service. Nothing reads these tables yet — the app behaves
-- byte-identically after this migration.
--
-- Types follow the house convention (LocalDateTime -> TIMESTAMP, not
-- timestamptz; LocalTime -> TIME) because the app boots ddl-auto=validate.
-- day_of_week mirrors working_hours.day_of_week (JPA EnumType.STRING,
-- values 'MONDAY'..'SUNDAY').
--
-- Seed guard (V73/V80 style): the DO $$ block ABORTS LOUDLY unless exactly
-- one row exists in users WHERE role='ADMIN' (a wrong seed here would
-- silently mis-attribute every backfilled booking in V83). Idempotent: the
-- seed is skipped entirely if staff_members already has rows. Postgres wraps
-- the whole migration in one transaction — any failure rolls back everything.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.staff_working_hours;
--   DROP TABLE IF EXISTS public.staff_services;
--   DROP TABLE IF EXISTS public.staff_members;
-- ============================================================

-- 1. Staff registry. user_id is the optional login account (the owner's ADMIN
--    user now; STAFF users from prompt 02 onward). NULL = no login yet.
CREATE TABLE public.staff_members (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        UNIQUE REFERENCES public.users (user_id),
    display_name VARCHAR(80) NOT NULL,
    color        VARCHAR(7),
    active       BOOLEAN     NOT NULL DEFAULT true,
    sort_order   INT         NOT NULL DEFAULT 0,
    created_at   TIMESTAMP   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP
);

-- 2. Qualification matrix (R4): which staff member performs which service.
CREATE TABLE public.staff_services (
    staff_id   UUID NOT NULL REFERENCES public.staff_members (id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services (service_id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, service_id)
);

-- 3. Per-staff weekly hours (R5) — same shape as the legacy working_hours
--    table, plus the staff FK. One row per (staff, day).
CREATE TABLE public.staff_working_hours (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        UUID        NOT NULL REFERENCES public.staff_members (id) ON DELETE CASCADE,
    day_of_week     VARCHAR(16) NOT NULL,
    morning_start   TIME,
    morning_end     TIME,
    afternoon_start TIME,
    afternoon_end   TIME,
    closed          BOOLEAN     NOT NULL DEFAULT false,
    CONSTRAINT uk_staff_working_hours_staff_day UNIQUE (staff_id, day_of_week)
);

-- 4. Seed the owner's staff row (guarded + idempotent, see header).
DO $$
DECLARE
    admin_count integer;
    v_admin_id  uuid;
    v_name      varchar;
    v_staff_id  uuid;
BEGIN
    -- Idempotency: rerun on an already-seeded DB is a no-op.
    IF EXISTS (SELECT 1 FROM public.staff_members) THEN
        RAISE NOTICE 'V82: staff_members already populated — seed skipped.';
        RETURN;
    END IF;

    -- Guard: exactly one ADMIN user (the owner). Anything else means the
    -- identity model diverged from the audit — abort and investigate.
    SELECT count(*) INTO admin_count FROM public.users WHERE role = 'ADMIN';
    IF admin_count <> 1 THEN
        RAISE EXCEPTION
            'V82 aborted: expected exactly one users row with role=ADMIN, found %. Resolve before seeding staff.',
            admin_count;
    END IF;

    SELECT user_id, name INTO v_admin_id, v_name
    FROM public.users WHERE role = 'ADMIN';

    INSERT INTO public.staff_members (user_id, display_name, active, sort_order)
    VALUES (v_admin_id, v_name, true, 0)
    RETURNING id INTO v_staff_id;

    -- Copy the salon's weekly hours as her personal hours (legacy
    -- working_hours stays in place and frozen — see audit §3.5).
    INSERT INTO public.staff_working_hours
        (staff_id, day_of_week, morning_start, morning_end, afternoon_start, afternoon_end, closed)
    SELECT v_staff_id, day_of_week, morning_start, morning_end, afternoon_start, afternoon_end, closed
    FROM public.working_hours;

    -- She currently performs every catalog service.
    INSERT INTO public.staff_services (staff_id, service_id)
    SELECT v_staff_id, service_id FROM public.services;
END $$;
