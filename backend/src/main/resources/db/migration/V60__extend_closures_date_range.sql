-- V60 — Closures: add start_date / end_date for multi-day range support.
--
-- Strategy: purely additive. The legacy `date` column stays NOT NULL — the
-- entity keeps writing `date = start_date` on every insert/update. A future
-- migration will drop the NOT NULL constraint and then the column itself,
-- once no code path references it any longer.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_closure_range;
--   ALTER TABLE closures DROP COLUMN IF EXISTS end_date;
--   ALTER TABLE closures DROP COLUMN IF EXISTS start_date;

ALTER TABLE closures ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE closures ADD COLUMN IF NOT EXISTS end_date   DATE;

-- Backfill so the entity can declare these NOT NULL at the JPA layer.
UPDATE closures SET start_date = date WHERE start_date IS NULL;
UPDATE closures SET end_date   = date WHERE end_date   IS NULL;

CREATE INDEX IF NOT EXISTS idx_closure_range
    ON closures (start_date, end_date);
