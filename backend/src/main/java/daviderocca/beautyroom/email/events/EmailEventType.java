package daviderocca.beautyroom.email.events;

public enum EmailEventType {
    BOOKING_CONFIRMED,
    BOOKING_REMINDER_24H,
    ORDER_PAID,
    PAID_CONFLICT,
    // FIX-6: notifica cliente rimborso automatico in caso di PAID_CONFLICT (slot occupato)
    BOOKING_REFUNDED,
    // PROMPT A: rimborso neutro concordato (NON slot occupato) — booking e ordine
    BOOKING_REFUND_CONFIRMED,
    ORDER_REFUND_CONFIRMED,
    // PROMPT B: appuntamento spostato (from→to) e annullato (generico)
    BOOKING_RESCHEDULED,
    BOOKING_CANCELLED,
    REVIEW_REQUEST,
    WAITLIST_SLOT_AVAILABLE,
    USER_REGISTERED,
    WISHLIST_BACK_IN_STOCK
}