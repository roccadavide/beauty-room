package daviderocca.beautyroom;

import daviderocca.beautyroom.enums.DiscountType;
import daviderocca.beautyroom.util.PricingUtils;
import daviderocca.beautyroom.util.PricingUtils.PromoBundle;
import daviderocca.beautyroom.util.PricingUtils.PromoLine;
import daviderocca.beautyroom.util.PricingUtils.PromoLineResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure unit tests (no Spring) for {@link PricingUtils#computeMultiServicePromoBundle}.
 * The load-bearing contract is the invariant asserted in every case:
 * Σ per-line discounted == totalDiscounted.
 */
class PricingUtilsPromoBundleTest {

    // --- helpers ---------------------------------------------------------------

    private static PromoLine line(String price) {
        return new PromoLine(null, null, "line", price == null ? null : new BigDecimal(price), 30);
    }

    private static BigDecimal sumOf(PromoBundle b) {
        BigDecimal s = BigDecimal.ZERO;
        for (PromoLineResult r : b.serviceResults()) s = s.add(r.discountedPrice());
        for (PromoLineResult r : b.productResults()) s = s.add(r.discountedPrice());
        return s;
    }

    /** The whole reason this method exists: lines must reconcile to the total, exactly. */
    private static void assertInvariant(PromoBundle b) {
        assertEquals(0, sumOf(b).compareTo(b.totalDiscounted()),
                "Σ per-line discounted must equal totalDiscounted");
        assertTrue(b.savings().signum() >= 0, "savings must never be negative");
    }

    private static void eq(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
                "expected " + expected + " but was " + actual);
    }

    // --- cases -----------------------------------------------------------------

    @Test
    @DisplayName("PERCENTAGE: 2 services + 1 product, even split")
    void percentageTwoServicesOneProduct() {
        PromoBundle b = PricingUtils.computeMultiServicePromoBundle(
                DiscountType.PERCENTAGE, new BigDecimal("20"),
                List.of(line("50.00"), line("30.00")), List.of(line("20.00")));

        eq("100.00", b.totalOriginal());
        eq("80.00", b.totalDiscounted());
        eq("20.00", b.savings());
        eq("40.00", b.serviceResults().get(0).discountedPrice());
        eq("24.00", b.serviceResults().get(1).discountedPrice());
        eq("16.00", b.productResults().get(0).discountedPrice());
        assertInvariant(b);
    }

    @Test
    @DisplayName("PERCENTAGE: rounding remainder lands on the FIRST line (a service)")
    void percentageRemainderOnFirstLine() {
        // 1 service + 2 products @ 3.00 each, 10% off.
        // total 9.00 -> discounted 8.00; each raw 2.667 -> 2.50 (sum 7.50);
        // remainder 0.50 added to the first line (the service) -> 3.00.
        PromoBundle b = PricingUtils.computeMultiServicePromoBundle(
                DiscountType.PERCENTAGE, new BigDecimal("10"),
                List.of(line("3.00")), List.of(line("3.00"), line("3.00")));

        eq("9.00", b.totalOriginal());
        eq("8.00", b.totalDiscounted());
        eq("3.00", b.serviceResults().get(0).discountedPrice()); // first line absorbs remainder
        eq("2.50", b.productResults().get(0).discountedPrice());
        eq("2.50", b.productResults().get(1).discountedPrice());
        assertInvariant(b);
    }

    @Test
    @DisplayName("FIXED: flat amount off the whole bundle")
    void fixedAmount() {
        PromoBundle b = PricingUtils.computeMultiServicePromoBundle(
                DiscountType.FIXED, new BigDecimal("30"),
                List.of(line("60.00"), line("40.00")), List.of());

        eq("100.00", b.totalOriginal());
        eq("70.00", b.totalDiscounted());
        eq("30.00", b.savings());
        eq("42.00", b.serviceResults().get(0).discountedPrice());
        eq("28.00", b.serviceResults().get(1).discountedPrice());
        assertInvariant(b);
    }

    @Test
    @DisplayName("PRICE_OVERRIDE: total forced to the rounded override, distributed pro-rata")
    void priceOverride() {
        // override 49.99 -> rounds to 50.00; split across 40.00 + 40.00 -> 25.00 each.
        PromoBundle b = PricingUtils.computeMultiServicePromoBundle(
                DiscountType.PRICE_OVERRIDE, new BigDecimal("49.99"),
                List.of(line("40.00")), List.of(line("40.00")));

        eq("80.00", b.totalOriginal());
        eq("50.00", b.totalDiscounted());
        eq("30.00", b.savings());
        eq("25.00", b.serviceResults().get(0).discountedPrice());
        eq("25.00", b.productResults().get(0).discountedPrice());
        assertInvariant(b);
    }

    @Test
    @DisplayName("NONE: discounted == original, zero savings")
    void none() {
        PromoBundle b = PricingUtils.computeMultiServicePromoBundle(
                DiscountType.NONE, null,
                List.of(line("33.00")), List.of(line("17.00")));

        eq("50.00", b.totalOriginal());
        eq("50.00", b.totalDiscounted());
        eq("0.00", b.savings());
        eq("33.00", b.serviceResults().get(0).discountedPrice());
        eq("17.00", b.productResults().get(0).discountedPrice());
        assertInvariant(b);
    }

    @Test
    @DisplayName("Empty bundle: all zero, invariant holds")
    void emptyBundle() {
        PromoBundle b = PricingUtils.computeMultiServicePromoBundle(
                DiscountType.PERCENTAGE, new BigDecimal("20"),
                List.of(), List.of());

        eq("0.00", b.totalOriginal());
        eq("0.00", b.totalDiscounted());
        eq("0.00", b.savings());
        assertTrue(b.serviceResults().isEmpty());
        assertTrue(b.productResults().isEmpty());
        assertInvariant(b);
    }

    @Test
    @DisplayName("Zero-priced lines (totalOriginal == 0): every line zero, even on PRICE_OVERRIDE")
    void zeroPricedLines() {
        // PRICE_OVERRIDE would otherwise force a non-zero total; the zero-bundle guard
        // keeps the invariant (sum of lines == totalDiscounted == 0).
        PromoBundle b = PricingUtils.computeMultiServicePromoBundle(
                DiscountType.PRICE_OVERRIDE, new BigDecimal("50"),
                List.of(line("0.00")), List.of(line("0.00")));

        eq("0.00", b.totalOriginal());
        eq("0.00", b.totalDiscounted());
        eq("0.00", b.serviceResults().get(0).discountedPrice());
        eq("0.00", b.productResults().get(0).discountedPrice());
        assertInvariant(b);
    }

    @Test
    @DisplayName("Null lists are treated as empty")
    void nullListsAreEmpty() {
        PromoBundle b = PricingUtils.computeMultiServicePromoBundle(
                DiscountType.PERCENTAGE, new BigDecimal("20"), null, null);

        eq("0.00", b.totalOriginal());
        eq("0.00", b.totalDiscounted());
        assertTrue(b.serviceResults().isEmpty());
        assertTrue(b.productResults().isEmpty());
        assertInvariant(b);
    }
}
