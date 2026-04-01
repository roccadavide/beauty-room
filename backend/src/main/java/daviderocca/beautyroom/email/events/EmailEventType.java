package daviderocca.beautyroom.email.events;

public enum EmailEventType {
    BOOKING_CONFIRMED,
    BOOKING_REMINDER_24H,
    ORDER_PAID,
    PAID_CONFLICT,
    // FIX-6: notifica cliente rimborso automatico in caso di PAID_CONFLICT
    BOOKING_REFUNDED,
    REVIEW_REQUEST,
    WAITLIST_SLOT_AVAILABLE
}