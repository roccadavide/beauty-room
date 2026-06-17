-- Stage 2 of the package-credit ownership fix: backfill customer_id on PRE-EXISTING credits, but
-- ONLY where the owner is unambiguous — i.e. the credit's bookings carry exactly one distinct,
-- non-null customer_id. Ambiguous credits (bookings disagree), email-only credits and orphans
-- (no linking booking with a customer) are LEFT NULL for manual handling: the migration must never
-- guess an owner. A credit can have N bookings (the 1:1 was dropped in V10 — sessions 2…N share it),
-- hence DISTINCT + the HAVING = 1 guard.
--
-- Data-only: no schema change (column/FK/index landed in V74), no entity change, no bridge change
-- (Stage 3 switches the EXISTS(booking…) query). Idempotent / additive: the `pc.customer_id IS NULL`
-- guard means a re-run sets nothing new and it never overwrites a value already set (e.g. by the
-- Stage-1 forward-fill on a new purchase).
--
-- Owner expression: the unique owner is extracted with (array_agg(DISTINCT …))[1], NOT
-- MIN(b.customer_id) — PostgreSQL ships no min/max aggregate for the uuid type ("function min(uuid)
-- does not exist", verified on the dev DB / PG 14). The HAVING COUNT(DISTINCT …) = 1 guarantees the
-- group holds exactly one distinct customer_id, so the single array element IS that owner — not an
-- arbitrary pick among several.

UPDATE public.package_credits pc
SET customer_id = sub.cid
FROM (
  SELECT b.package_credit_id,
         (array_agg(DISTINCT b.customer_id))[1] AS cid   -- the one distinct owner (guarded below)
  FROM bookings b
  WHERE b.customer_id IS NOT NULL
  GROUP BY b.package_credit_id
  HAVING COUNT(DISTINCT b.customer_id) = 1                -- unambiguous only
) sub
WHERE pc.package_credit_id = sub.package_credit_id
  AND pc.customer_id IS NULL;                             -- idempotent: never touch already-set rows
