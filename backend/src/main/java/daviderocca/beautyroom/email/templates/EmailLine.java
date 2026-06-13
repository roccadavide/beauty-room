package daviderocca.beautyroom.email.templates;

/**
 * One rendered line inside a booking-email panel section.
 * {@code meta}, {@code priceStr} and {@code strikeStr} may be null:
 * - meta      → small grey detail (e.g. "Qt. 2 · € 30,00 cad.")
 * - priceStr  → already-formatted right-aligned price (e.g. "€ 1.200,00"); null hides the price cell
 * - strikeStr → already-formatted struck-through original price (promo lines); null = no strike
 */
public record EmailLine(String name, String meta, String priceStr, String strikeStr) {}
