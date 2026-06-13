package daviderocca.beautyroom.email.templates;

import java.util.List;

/** A labelled group of {@link EmailLine}s inside the booking-email panel (e.g. "Trattamento", "Promozione · ...", "Prodotti"). */
public record EmailSection(String label, List<EmailLine> lines) {}
