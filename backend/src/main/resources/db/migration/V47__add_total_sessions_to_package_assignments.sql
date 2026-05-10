-- Add the total_sessions column to client_package_assignments.
-- Required by ClientPackageAssignment entity: @Column(name = "total_sessions", nullable = false).
-- V42 added sessions_remaining and custom_package_name but omitted this column.
-- V43 dropped the legacy sessions_total column, so total_sessions was never present.
--
-- Rollback:
--   ALTER TABLE client_package_assignments DROP COLUMN IF EXISTS total_sessions;

ALTER TABLE client_package_assignments
    ADD COLUMN IF NOT EXISTS total_sessions INTEGER NOT NULL DEFAULT 0;
