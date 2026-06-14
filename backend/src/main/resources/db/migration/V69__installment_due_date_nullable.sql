-- V69: make package_installments.due_date nullable ("da definire" installments).
--
-- Phase 5d. A "da definire" rata has no due date yet: it floats — excluded from the
-- date-range feeds (due_date BETWEEN / <= today never match NULL), so it neither
-- surfaces on any day nor trips the "Completa" gate. When the package's next
-- appointment is created, the booking flow snaps such a rata's due_date to that
-- appointment's date, turning it back into an ordinary dated installment.
--
-- Purely additive: existing dated rate are untouched (no backfill). Changes no
-- existing behavior — date-less is a new, opt-in state.
--
-- Rollback (only if no NULL due_date rows exist):
--   ALTER TABLE package_installments ALTER COLUMN due_date SET NOT NULL;

ALTER TABLE package_installments ALTER COLUMN due_date DROP NOT NULL;
