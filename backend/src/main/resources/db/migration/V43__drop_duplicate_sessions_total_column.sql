-- Drop the legacy "sessions_total" column from client_package_assignments.
-- The entity uses @Column(name = "total_sessions") which was added in V42.
-- "sessions_total" (created in V39) is a duplicate and must be removed.
--
-- Rollback:
--   ALTER TABLE client_package_assignments ADD COLUMN IF NOT EXISTS sessions_total INTEGER;

ALTER TABLE client_package_assignments
    DROP COLUMN IF EXISTS sessions_total;
