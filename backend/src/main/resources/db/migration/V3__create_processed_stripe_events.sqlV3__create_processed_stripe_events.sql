CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id VARCHAR(64) PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL
);