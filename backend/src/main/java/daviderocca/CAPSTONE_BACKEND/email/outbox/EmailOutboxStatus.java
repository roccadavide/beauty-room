package daviderocca.CAPSTONE_BACKEND.email.outbox;

public enum EmailOutboxStatus {
    PENDING,
    PROCESSING,
    SENT,
    FAILED,
    CANCELLED
}