package daviderocca.beautyroom.email.outbox;

public enum EmailOutboxStatus {
    PENDING,
    PROCESSING,
    SENT,
    FAILED,
    CANCELLED
}