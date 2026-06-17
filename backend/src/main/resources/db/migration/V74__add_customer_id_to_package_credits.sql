-- Stage 1 of the package-credit ownership fix.
--
-- Today a credit's owner is deduced via the customer's bookings (booking.customer + booking.packageCredit),
-- so detaching the last booking orphans a paid credit (it vanishes from the per-customer bridge). The fix
-- is a stable customer_id directly on package_credits. This migration only adds the column + FK + index —
-- it does NOT backfill existing rows (Stage 2) and does NOT change the bridge query (Stage 3 switches it).
--
-- Mirrors bookings.customer_id (V11:36-41): nullable, ON DELETE SET NULL (a paid credit must never be
-- cascade-deleted — deleting a customer just detaches), partial index for the upcoming bridge lookup.

ALTER TABLE public.package_credits
    ADD COLUMN IF NOT EXISTS customer_id UUID
        REFERENCES public.customers(customer_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pkg_customer
    ON public.package_credits (customer_id)
    WHERE customer_id IS NOT NULL;
