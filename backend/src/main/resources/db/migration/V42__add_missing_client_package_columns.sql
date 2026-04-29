-- Add columns to client_package_assignments that are required by the
-- ClientPackageAssignment entity but were missing from the original V39 migration.
--
-- Rollback:
--   ALTER TABLE client_package_assignments
--       DROP COLUMN IF EXISTS sessions_remaining,
--       DROP COLUMN IF EXISTS custom_package_name;

ALTER TABLE client_package_assignments
    ADD COLUMN IF NOT EXISTS sessions_remaining INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS custom_package_name VARCHAR(255);
