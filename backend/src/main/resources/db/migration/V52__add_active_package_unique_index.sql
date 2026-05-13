-- V52: prevent duplicate ACTIVE packages for the same client + service option.
--
-- Two rows with the same LOWER(client_name) and the same service_option_id are not
-- allowed when both have status = 'ACTIVE'. NULLs in service_option_id are excluded
-- so that custom (ad-hoc) packages can always coexist.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_client_pkg_active_unique_option;

CREATE UNIQUE INDEX idx_client_pkg_active_unique_option
    ON client_package_assignments (LOWER(client_name), service_option_id)
    WHERE status = 'ACTIVE' AND service_option_id IS NOT NULL;
