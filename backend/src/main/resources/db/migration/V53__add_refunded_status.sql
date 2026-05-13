-- =============================================================================
-- V53: aggiungi stato REFUNDED a bookings e package_credits
-- =============================================================================

-- 1. Booking status CHECK constraint
ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_booking_status_check
        CHECK (booking_status::text = ANY (ARRAY[
            'PENDING_PAYMENT'::text,
            'CONFIRMED'::text,
            'CANCELLED'::text,
            'COMPLETED'::text,
            'NO_SHOW'::text,
            'REFUNDED'::text
        ]));

-- 2. PackageCredit status CHECK constraint
ALTER TABLE public.package_credits
    DROP CONSTRAINT IF EXISTS package_credits_status_check;

ALTER TABLE public.package_credits
    ADD CONSTRAINT package_credits_status_check
        CHECK (status::text = ANY (ARRAY[
            'ACTIVE'::text,
            'COMPLETED'::text,
            'EXPIRED'::text,
            'REFUNDED'::text,
            'EXHAUSTED'::text,   -- legacy
            'CANCELLED'::text    -- legacy
        ]));
