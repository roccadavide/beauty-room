-- V68: package installment registry (payment "rate" system — backend foundation).
--
-- Purely additive: introduces a payment mode on the assignment and a child table
-- that records arbitrary payments. UPFRONT = a single paid installment for the full
-- amount; INSTALLMENTS = arbitrary amounts on arbitrary dates. Changes NO existing
-- behavior — the agenda, the revenue report, and the per-session/UPFRONT settlement
-- flow remain untouched (later phases).
--
-- PK + TIMESTAMP idioms match V39/V40/V59 (UUID DEFAULT gen_random_uuid(),
-- TIMESTAMP NOT NULL DEFAULT NOW()). gen_random_uuid() is the SQL-side UUID idiom
-- used by every prior table-creating migration here.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_pkg_installment_paid_date;
--   DROP INDEX IF EXISTS idx_pkg_installment_due_unpaid;
--   DROP INDEX IF EXISTS idx_pkg_installment_assignment;
--   DROP TABLE IF EXISTS package_installments;
--   ALTER TABLE client_package_assignments DROP COLUMN IF EXISTS payment_mode;

-- 1) payment mode on the assignment
ALTER TABLE client_package_assignments
    ADD COLUMN payment_mode VARCHAR(20) NOT NULL DEFAULT 'PER_SESSION';

-- 2) backfill: existing upfront packages become UPFRONT
UPDATE client_package_assignments SET payment_mode = 'UPFRONT' WHERE paid_upfront = true;

-- 3) installment registry
CREATE TABLE package_installments (
    id                            UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_package_assignment_id  UUID          NOT NULL REFERENCES client_package_assignments(id) ON DELETE CASCADE,
    amount                        NUMERIC(10,2) NOT NULL,
    due_date                      DATE          NOT NULL,
    paid                          BOOLEAN       NOT NULL DEFAULT false,
    paid_date                     DATE,
    payment_method                VARCHAR(20),
    note                          VARCHAR(255),
    position                      INTEGER       NOT NULL DEFAULT 0,
    created_at                    TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMP
);

-- 4) indices (WHERE/JOIN/ORDER BY per CLAUDE.md)
CREATE INDEX idx_pkg_installment_assignment ON package_installments (client_package_assignment_id);
CREATE INDEX idx_pkg_installment_due_unpaid ON package_installments (due_date) WHERE paid = false;
CREATE INDEX idx_pkg_installment_paid_date  ON package_installments (paid_date) WHERE paid = true;

-- 5) DECISION (documented): seed ONE PAID installment for each existing non-cancelled
--    UPFRONT package — full amount, dated to created_at. This makes historical upfront
--    packages reconcilable and reflects the revenue they truly collected. CANCELLED
--    packages are skipped (possibly refunded — ambiguous).
--    On the current dev DB this affects exactly 1 row.
INSERT INTO package_installments
    (id, client_package_assignment_id, amount, due_date, paid, paid_date, position, created_at, updated_at)
SELECT gen_random_uuid(), id, price_paid, created_at::date, true, created_at::date, 0, created_at, created_at
  FROM client_package_assignments
 WHERE paid_upfront = true AND price_paid IS NOT NULL AND status <> 'CANCELLED';
