-- V72: online PackageCredit consume model — booking-time tracking flag.
--
-- The online PackageCredit session is now decremented at BOOKING time (mirroring the admin
-- ClientPackageAssignment / BookingPackageLink.session_tracked_at_creation model) instead of at
-- completion, and restored on cancel / no-show. This per-booking flag makes every online
-- decrement and restore IDEMPOTENT:
--   * decrement only when the flag is FALSE → then set TRUE;
--   * restore   only when the flag is TRUE  → then set FALSE.
-- So a re-save, an edit, or a double status transition never double-counts a session.
--
-- Backfill: under the OLD model the online session was decremented at COMPLETION, so a
-- currently-COMPLETED online booking already HOLDS one decrement against its credit. Mark
-- exactly those as tracked, so a later cancel / no-show restores them correctly and the
-- flag↔counter invariant holds for existing rows. CONFIRMED / PENDING_PAYMENT online bookings
-- were never decremented under the old model → the flag stays FALSE (consistent: they hold no
-- decrement). booking_status is stored as text (EnumType.STRING).
--
-- ddl-auto=validate: the column must exist and match Booking.creditTrackedAtCreation
-- (boolean NOT NULL). Idempotent (IF NOT EXISTS + guarded UPDATE).
--
-- Rollback:
--   ALTER TABLE bookings DROP COLUMN IF EXISTS credit_tracked_at_creation;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS credit_tracked_at_creation BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE bookings
   SET credit_tracked_at_creation = TRUE
 WHERE package_credit_id IS NOT NULL
   AND booking_status = 'COMPLETED'
   AND credit_tracked_at_creation = FALSE;
