-- V38: extend bookings with custom-service fields, session counters, and account-linking columns
--
-- All new columns on existing table are nullable (or have a safe DEFAULT).
-- Existing rows are unaffected.
--
-- Rollback:
--   ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_linking_status_check;
--   DROP INDEX IF EXISTS idx_booking_linking_status;
--   DROP INDEX IF EXISTS idx_booking_linked_user;
--   ALTER TABLE bookings
--       DROP COLUMN IF EXISTS is_custom_service,
--       DROP COLUMN IF EXISTS custom_service_name,
--       DROP COLUMN IF EXISTS custom_service_price,
--       DROP COLUMN IF EXISTS current_session,
--       DROP COLUMN IF EXISTS total_sessions,
--       DROP COLUMN IF EXISTS linked_user_id,
--       DROP COLUMN IF EXISTS linking_status;

-- ── 1. Custom-service fields ─────────────────────────────────────────────────
-- When Michela creates a booking with a free-form service name instead of
-- picking from the catalogue (is_custom_service = TRUE).
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS is_custom_service    BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS custom_service_name  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS custom_service_price NUMERIC(10,2);

-- ── 2. Session counters ───────────────────────────────────────────────────────
-- Tracks "this is session N of M" for multi-session services that are NOT
-- sold as a package (e.g. a laser course billed per visit).
-- Distinct from package_credit sessions_remaining.
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS current_session INTEGER,
    ADD COLUMN IF NOT EXISTS total_sessions  INTEGER;

-- ── 3. Account-linking ────────────────────────────────────────────────────────
-- After a guest books, if they later register with the same email the booking
-- can be retroactively linked to their account.
-- linked_user_id: the registered account, set by the linking job.
-- linking_status: tracks the auto-link outcome.
--   NONE       — default, not yet processed
--   LINKED     — successfully matched and linked to a user account
--   UNMATCHED  — no account with that email at link time
--   AMBIGUOUS  — multiple accounts found for that email (manual review needed)
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS linking_status VARCHAR(20) NOT NULL DEFAULT 'NONE';

ALTER TABLE bookings
    ADD CONSTRAINT bookings_linking_status_check
    CHECK (linking_status IN ('NONE', 'LINKED', 'UNMATCHED', 'AMBIGUOUS'));

-- Partial indexes — only index rows where linking is relevant
CREATE INDEX IF NOT EXISTS idx_booking_linked_user
    ON bookings (linked_user_id)
    WHERE linked_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_linking_status
    ON bookings (linking_status)
    WHERE linking_status <> 'NONE';
