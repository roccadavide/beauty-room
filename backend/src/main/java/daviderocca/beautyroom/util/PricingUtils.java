package daviderocca.beautyroom.util;

import daviderocca.beautyroom.enums.DiscountType;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

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

    // ----------------------- Multi-service promo bundle -----------------------
    // Single source of truth for pricing a promotion attached to an appointment
    // (08.2 agenda snapshot) and an online promo checkout (08.3): one discount on
    // the WHOLE bundle (all services + all products), then the rounded total is
    // distributed back across the lines proportionally to each line's full price.

    /** One priced line of a promo bundle (a service or a product). */
    public record PromoLine(UUID id, UUID optionId, String name,
                            BigDecimal fullPrice, Integer durationMin) {}

    /** A line paired with its computed discounted price. */
    public record PromoLineResult(PromoLine line, BigDecimal discountedPrice) {}

    /**
     * The fully-priced bundle. {@code serviceResults} / {@code productResults} preserve
     * input order, and the per-line discounted prices sum EXACTLY to {@code totalDiscounted}.
     */
    public record PromoBundle(BigDecimal totalOriginal,
                              BigDecimal totalDiscounted,
                              BigDecimal savings,
                              List<PromoLineResult> serviceResults,
                              List<PromoLineResult> productResults) {}

    /**
     * Discount applied to the WHOLE bundle (every service + every product), then the
     * rounded bundle total is distributed back across the lines proportionally to each
     * line's full price; the rounding remainder lands on the FIRST line (services first,
     * then products) so the per-line discounted prices sum EXACTLY to {@code totalDiscounted}.
     * All amounts use the existing {@link #PROMO_ROUNDING_STEP} rounding via
     * {@link #applyPromoDiscount} / {@link #roundPromoPrice}. {@code type == NONE} → no discount.
     * Pure: deterministic, no I/O, no Spring.
     */
    public static PromoBundle computeMultiServicePromoBundle(
            DiscountType type, BigDecimal value,
            List<PromoLine> services, List<PromoLine> products) {

        List<PromoLine> svc = services == null ? List.of() : services;
        List<PromoLine> prd = products == null ? List.of() : products;

        // Ordered combined view: services first, then products.
        List<PromoLine> combined = new ArrayList<>(svc.size() + prd.size());
        combined.addAll(svc);
        combined.addAll(prd);

        BigDecimal totalOriginal = BigDecimal.ZERO;
        for (PromoLine l : combined) {
            totalOriginal = totalOriginal.add(nz(l.fullPrice()));
        }
        totalOriginal = totalOriginal.setScale(2, RoundingMode.HALF_UP);

        BigDecimal zero = BigDecimal.ZERO.setScale(2);

        // Empty/zero bundle: nothing to discount or distribute. Keeps the invariant
        // (sum of lines == totalDiscounted) even for a PRICE_OVERRIDE on no value.
        if (totalOriginal.signum() == 0) {
            return new PromoBundle(zero, zero, zero, zeroResults(svc), zeroResults(prd));
        }

        BigDecimal totalDiscounted = roundPromoPrice(applyPromoDiscount(totalOriginal, type, value));

        // Proportional distribution; remainder reconciled onto the first line.
        BigDecimal[] lineDisc = new BigDecimal[combined.size()];
        BigDecimal sumRounded = BigDecimal.ZERO;
        for (int i = 0; i < combined.size(); i++) {
            BigDecimal raw = nz(combined.get(i).fullPrice())
                    .multiply(totalDiscounted)
                    .divide(totalOriginal, 10, RoundingMode.HALF_UP);
            lineDisc[i] = roundPromoPrice(raw);
            sumRounded = sumRounded.add(lineDisc[i]);
        }
        // combined is non-empty here (totalOriginal > 0 implies at least one line).
        BigDecimal diff = totalDiscounted.subtract(sumRounded);
        lineDisc[0] = lineDisc[0].add(diff).setScale(2, RoundingMode.HALF_UP);

        List<PromoLineResult> svcRes = new ArrayList<>(svc.size());
        for (int i = 0; i < svc.size(); i++) {
            svcRes.add(new PromoLineResult(svc.get(i), lineDisc[i]));
        }
        List<PromoLineResult> prdRes = new ArrayList<>(prd.size());
        for (int j = 0; j < prd.size(); j++) {
            prdRes.add(new PromoLineResult(prd.get(j), lineDisc[svc.size() + j]));
        }

        BigDecimal savings = totalOriginal.subtract(totalDiscounted)
                .max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        return new PromoBundle(totalOriginal, totalDiscounted, savings, svcRes, prdRes);
    }

    /** Null full price counts as zero (qty is implicitly 1 per promo line). */
    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static List<PromoLineResult> zeroResults(List<PromoLine> lines) {
        BigDecimal zero = BigDecimal.ZERO.setScale(2);
        List<PromoLineResult> out = new ArrayList<>(lines.size());
        for (PromoLine l : lines) {
            out.add(new PromoLineResult(l, zero));
        }
        return out;
    }
}
