-- ============================================================
-- V11 – Customer registry
-- Adds a lightweight customer table and links bookings to it.
-- Fully additive / idempotent – no existing data is touched.
-- ============================================================

-- 1. customers table
CREATE TABLE IF NOT EXISTS public.customers (
    customer_id UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name   VARCHAR(255) NOT NULL,
    phone       VARCHAR(50),
    email       VARCHAR(255),
    notes       TEXT,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now()
);

-- 2. Unique phone among real customers (walk-in emails don't affect this)
--    Partial: only enforced when phone is present.
CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_phone
    ON public.customers (phone)
    WHERE phone IS NOT NULL;

-- 3. Fast case-insensitive name search
CREATE INDEX IF NOT EXISTS idx_customer_name_lower
    ON public.customers (lower(full_name));

-- 4. Fast email lookup (for registered customers)
CREATE INDEX IF NOT EXISTS idx_customer_email_lower
    ON public.customers (lower(email))
    WHERE email IS NOT NULL;

-- 5. Add nullable FK from bookings → customers
--    ON DELETE SET NULL: if a customer record is ever removed the booking survives.
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS customer_id UUID
        REFERENCES public.customers(customer_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_booking_customer_id
    ON public.bookings (customer_id)
    WHERE customer_id IS NOT NULL;