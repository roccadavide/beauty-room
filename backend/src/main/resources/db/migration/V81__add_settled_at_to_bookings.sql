-- V81 — revenue report (cash-basis): per-booking in-store settlement timestamp.
-- The report dates every collected euro at COLLECTION time. Online bookings already
-- carry paid_at, but in-store settlements were dateless (the per-line paid flags are
-- booleans with no date), so an in-store-collected euro could not be placed in a
-- period. settleBookingLines now stamps this column ONCE, when lines are first marked
-- paid (additive, never cleared/overwritten). This is the in-store collection axis.
-- Nullable + mirrors paid_at/completed_at's type exactly (prod runs ddl-auto=validate).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS settled_at timestamp(6) without time zone NULL;

-- Best-effort historical dating so PAST collected in-store revenue lands in a period.
-- settled_at = COALESCE(paid_at, completed_at) for bookings that represent collected
-- revenue: status COMPLETED, OR paid_in_store, OR having any paid catalog line. Never
-- overwrites a non-null value (idempotent on re-run). Freezes the historical date.
UPDATE bookings b
SET settled_at = COALESCE(b.paid_at, b.completed_at)
WHERE b.settled_at IS NULL
  AND COALESCE(b.paid_at, b.completed_at) IS NOT NULL
  AND (
        b.booking_status = 'COMPLETED'
     OR b.paid_in_store = true
     OR EXISTS (SELECT 1 FROM booking_services bs
                 WHERE bs.booking_id = b.booking_id AND bs.paid = true)
  );
