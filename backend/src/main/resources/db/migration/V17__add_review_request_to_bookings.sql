ALTER TABLE bookings
  ADD COLUMN review_request_sent_at TIMESTAMP DEFAULT NULL;

CREATE INDEX idx_booking_review_sent ON bookings (review_request_sent_at)
  WHERE review_request_sent_at IS NULL;

COMMENT ON COLUMN bookings.review_request_sent_at IS
  'Timestamp di quando è stata inviata la richiesta recensione. NULL = non ancora inviata.';
