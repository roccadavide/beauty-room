-- Block B: per-line paid flag for product sales (booking_sales).
-- Promo product-lines keep tracking paid on booking_promotion_link; this column
-- governs STANDALONE (promotion_link_id IS NULL) product sales added from the drawer.
ALTER TABLE booking_sales ADD COLUMN paid boolean NOT NULL DEFAULT false;

-- Existing sales pre-date the paid concept: treat them as already settled so they
-- don't resurface as arretrati. New rows default to false (da pagare).
UPDATE booking_sales SET paid = true;
