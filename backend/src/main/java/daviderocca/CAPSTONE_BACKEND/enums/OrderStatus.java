package daviderocca.CAPSTONE_BACKEND.enums;

public enum OrderStatus {
    /**
     * Deprecated: kept only for backward compatibility with legacy DB values.
     * Mapped logic should treat this as PENDING_PAYMENT.
     */
    @Deprecated
    PENDING,

    PENDING_PAYMENT,
    PAID_PENDING_PICKUP,
    CANCELED,
    COMPLETED,
    FAILED,
    REFUNDED,
    SHIPPED
}
