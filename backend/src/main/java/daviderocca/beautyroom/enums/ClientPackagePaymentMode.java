package daviderocca.beautyroom.enums;

/**
 * How a client package is settled.
 *   PER_SESSION  — pay per visit (today's default behavior).
 *   UPFRONT      — paid all at once (a single paid installment for the full amount).
 *   INSTALLMENTS — arbitrary amounts on arbitrary dates, tracked in the installment registry.
 */
public enum ClientPackagePaymentMode {
    PER_SESSION,
    UPFRONT,
    INSTALLMENTS
}
