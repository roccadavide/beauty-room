package daviderocca.beautyroom.DTO.promotionDTOs;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Dati autorevoli (calcolati server-side) per il checkout Stripe di una
 * promozione SOLO prodotti: id, titolo per la line item e importo già
 * arrotondato a 0,50 € via {@code PricingUtils.roundPromoPrice}.
 */
public record ProductPromoCheckoutInfo(UUID promotionId, String title, BigDecimal amount) {}
