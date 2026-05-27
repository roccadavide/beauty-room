-- V63 — Explicit package discriminator on service_options.
-- Replaces the implicit "sessions > 1" rule with a structural flag.
-- Also repairs the 7 laser packages whose `sessions` was reset to 1 by the
-- buggy admin "Gestione opzioni" save (pre-fix the front-end was hard-coding
-- sessions: 1 on every option update, silently demoting packages).

-- 1. Add the discriminator column ----------------------------------------------------
ALTER TABLE service_options
    ADD COLUMN IF NOT EXISTS is_package boolean NOT NULL DEFAULT false;

-- 2. Repair + classify the 7 corrupted laser packages -------------------------------
-- `sessions` was reset to 1 by the bug; all 7 are 10-session packages.
-- `duration_min` is already correct in the DB and is intentionally left untouched.
UPDATE service_options
SET is_package = true,
    sessions   = 10
WHERE option_id IN (
    'e817325a-7422-475c-98f9-1df905d36d95',
    '5d9187b9-ffc9-4b97-9bc5-1727f6d2ac79',
    'e0cf34ac-9767-42f3-897d-ef123861327f',
    '54c0961a-7665-49ab-9771-7877773ff349',
    'ac0cbe2d-ed98-4ddd-aa50-2c9a582d30fa',
    '6399d30d-be49-4939-afe0-cfbb70cdcea7',
    '6da86ecd-331a-470a-998e-30d3ea17584f'
);

-- 3. Invariant: a package must always have >= 2 sessions ----------------------------
ALTER TABLE service_options
    ADD CONSTRAINT chk_package_sessions
    CHECK (is_package = false OR (sessions IS NOT NULL AND sessions >= 2));
