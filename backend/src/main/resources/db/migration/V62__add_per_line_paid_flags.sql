-- V62: per-line-item payment status.
--
-- Retires the booking-level single flag bookings.paid_in_store (V50) in favour
-- of granular flags:
--   * booking_services.paid        — one boolean per catalog service line
--   * booking_package_link.paid    — one boolean per in-person package session
--   * bookings.custom_service_paid — one boolean for the custom (free-form) line
--
-- paid_in_store stays in the schema (dormant) for backwards compat; new code
-- paths do not write it. It can be dropped in a follow-up migration once we are
-- confident no legacy reader depends on it.
--
-- Backfill: every existing line of a paid_in_store=TRUE booking is marked paid
-- so historical appointments do not all suddenly show "Da pagare". paidOnline
-- (Stripe) stays a separately-maintained live signal — NOT backfilled here.
--
-- Idempotent (IF NOT EXISTS, WHERE … = FALSE guards).
--
-- Rollback:
--   ALTER TABLE booking_services DROP COLUMN IF EXISTS paid;
--   ALTER TABLE booking_package_link DROP COLUMN IF EXISTS paid;
--   ALTER TABLE bookings DROP COLUMN IF EXISTS custom_service_paid;

ALTER TABLE booking_services
    ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE booking_package_link
    ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS custom_service_paid BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill catalog service lines
UPDATE booking_services bs
   SET paid = TRUE
  FROM bookings b
 WHERE bs.booking_id = b.booking_id
   AND b.paid_in_store = TRUE
   AND bs.paid = FALSE;

-- Backfill package session lines
UPDATE booking_package_link bpl
   SET paid = TRUE
  FROM bookings b
 WHERE bpl.booking_id = b.booking_id
   AND b.paid_in_store = TRUE
   AND bpl.paid = FALSE;

-- Backfill custom service line
UPDATE bookings
   SET custom_service_paid = TRUE
 WHERE paid_in_store = TRUE
   AND is_custom_service = TRUE
   AND custom_service_paid = FALSE;
