package daviderocca.beautyroom.util;

import daviderocca.beautyroom.enums.DiscountType;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Utility di pricing per le promozioni. Il prezzo promozionale finale viene
 * arrotondato al multiplo di 0,50 € più vicino (pricing "pulito" premium),
 * coerentemente con il calcolo lato frontend (utils/promoPricing.js).
 */
public final class PricingUtils {

    /** Step di arrotondamento del prezzo promozionale finale. */
    public static final BigDecimal PROMO_ROUNDING_STEP = new BigDecimal("0.50");

    private PricingUtils() {}

    public static BigDecimal roundPromoPrice(BigDecimal value) {
        if (value == null) return null;
        return value.divide(PROMO_ROUNDING_STEP, 0, RoundingMode.HALF_UP)
                    .multiply(PROMO_ROUNDING_STEP)
                    .setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Applica lo sconto a un imponibile e arrotonda. Unica fonte di verità per
     * l'importo promo-prodotti: usata sia dal checkout
     * ({@code PromotionService.prepareProductPromoCheckout}) sia dal fulfillment
     * via webhook, così i due valori non possono divergere.
     */
    public static BigDecimal applyPromoDiscount(BigDecimal base, DiscountType type, BigDecimal value) {
        if (base == null) return null;
        BigDecimal discounted;
        switch (type) {
            case PERCENTAGE -> discounted = base.subtract(
                    base.multiply(value).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
            case FIXED -> discounted = base.subtract(value).max(BigDecimal.ZERO);
            case PRICE_OVERRIDE -> discounted = value;
            default -> discounted = base; // NONE: nessuno sconto
        }
        return roundPromoPrice(discounted);
    }
}
