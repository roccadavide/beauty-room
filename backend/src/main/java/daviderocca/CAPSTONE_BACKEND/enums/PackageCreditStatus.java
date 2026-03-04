package daviderocca.CAPSTONE_BACKEND.enums;

public enum PackageCreditStatus {
    ACTIVE,
    COMPLETED,   // sessionsRemaining == 0, corso naturale del pacchetto
    EXPIRED,     // expiryDate superata prima di esaurire le sedute
    EXHAUSTED,   // legacy — mantenuto per compatibilità DB
    CANCELLED    // legacy — mantenuto per compatibilità DB
}