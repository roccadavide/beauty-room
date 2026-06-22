package daviderocca.beautyroom.DTO.bookingDTOs;

public record BookingSummaryDTO(
        BookingResponseDTO booking,
        String paymentStatus,
        String customerEmail,
        // Audit K / Fix 23: definitive rejection signal for the confirmation page. Null on the
        // normal (processing/confirmed) path; "REJECTED" when the paid booking was rejected
        // (slot taken) and refunded; "REJECTED_REFUND_PENDING" when the auto-refund itself errored.
        String outcome,
        // PROMPT 27: actual amount charged by Stripe (session.getAmountTotal(), in cents). Nullable —
        // null when there is no Stripe session (e.g. the error() factory). Money-display source of truth:
        // the real charge, never a recomputed/catalog price.
        Long amountPaidCents
) {
    public static BookingSummaryDTO error(String msg) {
        return new BookingSummaryDTO(null, "ERROR: " + msg, null, null, null);
    }
}