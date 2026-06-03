package daviderocca.beautyroom.util;

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
}
