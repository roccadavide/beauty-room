CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_slot
ON bookings (start_time, end_time)
WHERE booking_status IN ('PENDING_PAYMENT', 'CONFIRMED');