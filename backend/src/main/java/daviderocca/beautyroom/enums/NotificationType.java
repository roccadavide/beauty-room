package daviderocca.beautyroom.enums;

public enum NotificationType {
    NEW_BOOKING,
    BOOKING_CANCELLED,
    NO_SHOW,
    NEW_ORDER,
    ORDER_CANCELLED,
    PMU_CONSENT,
    CLOSURE_REMINDER,
    BOOKING_CLOSURE_CONFLICT,
    // V64: a returning customer still has unpaid lines on past COMPLETED bookings.
    OUTSTANDING_PAYMENT,
    // Fix 3: an online-paid mixed cart hit insufficient stock / a missing product at fulfillment.
    // Persisted as STRING (AdminNotification.type @Enumerated(EnumType.STRING)) — additive, no migration.
    BOOKING_STOCK_WARNING
}
