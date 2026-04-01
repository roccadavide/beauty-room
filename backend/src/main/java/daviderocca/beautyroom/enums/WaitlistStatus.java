package daviderocca.beautyroom.enums;

public enum WaitlistStatus {
    WAITING,    // in attesa, non ancora notificata
    NOTIFIED,   // email inviata, token attivo
    BOOKED,     // ha prenotato tramite il link
    EXPIRED     // token scaduto, saltata
}
