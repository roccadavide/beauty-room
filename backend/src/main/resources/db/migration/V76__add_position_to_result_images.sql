-- Persist the order of result images so "before" (position 0) and "after" (position 1)
-- never get reshuffled by Postgres heap order or by Hibernate's delete-all+reinsert on update.

-- 1. Add the order column, nullable first so the backfill can populate it.
ALTER TABLE result_images
    ADD COLUMN position integer;

-- 2. Backfill existing rows. result_images has no primary key, so ctid is the physical row
--    identity. Order is frozen to current physical order, 0-based to match @OrderColumn's base.
--    Rows already stored in the wrong order stay as-is (no reliable signal exists to detect which
--    were inverted); from this point on the order is stable.
UPDATE result_images ri
SET position = sub.rn
FROM (
    SELECT ctid,
           (ROW_NUMBER() OVER (PARTITION BY result_id ORDER BY ctid) - 1) AS rn
    FROM result_images
) sub
WHERE ri.ctid = sub.ctid;

-- 3. Lock it down now that every row has a value.
ALTER TABLE result_images
    ALTER COLUMN position SET NOT NULL;
