-- V39: client_package_assignments — packages sold in-person by Michela
--
-- This is SEPARATE from package_credits (which are online Stripe purchases).
-- Use case: Michela sells a 10-session laser course to a walk-in client,
-- records it here, and tracks sessions manually from the agenda.
--
-- service_option_id references the service_options row that defines the
-- package type (sessions count, price, name). Nullable to allow ad-hoc
-- custom packages not tied to a catalogue option.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_client_pkg_linked_user;
--   DROP INDEX IF EXISTS idx_client_pkg_service_option;
--   DROP INDEX IF EXISTS idx_client_pkg_status;
--   DROP INDEX IF EXISTS idx_client_pkg_client_name_lower;
--   DROP TABLE IF EXISTS client_package_assignments;

CREATE TABLE client_package_assignments (
    id                UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Which package type was sold (service_options.sessions defines the total)
    service_option_id UUID         REFERENCES service_options(option_id) ON DELETE SET NULL,
    -- Client details as entered by Michela (may not have an account yet)
    client_name       VARCHAR(255) NOT NULL,
    client_email      VARCHAR(100),
    -- If the client later registers, link their account here
    linked_user_id    UUID         REFERENCES users(user_id) ON DELETE SET NULL,
    -- Session tracking
    sessions_total    INTEGER      NOT NULL,
    sessions_used     INTEGER      NOT NULL DEFAULT 0,
    -- Sale details
    price_paid        NUMERIC(10,2),
    purchase_date     DATE,
    notes             TEXT,
    status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP,
    CONSTRAINT client_pkg_status_check
        CHECK (status IN ('ACTIVE', 'EXHAUSTED', 'CANCELLED'))
);

-- Case-insensitive name lookup (Michela searches by client name in the agenda)
CREATE INDEX idx_client_pkg_client_name_lower
    ON client_package_assignments (LOWER(client_name));

CREATE INDEX idx_client_pkg_status
    ON client_package_assignments (status);

CREATE INDEX idx_client_pkg_service_option
    ON client_package_assignments (service_option_id)
    WHERE service_option_id IS NOT NULL;

CREATE INDEX idx_client_pkg_linked_user
    ON client_package_assignments (linked_user_id)
    WHERE linked_user_id IS NOT NULL;
