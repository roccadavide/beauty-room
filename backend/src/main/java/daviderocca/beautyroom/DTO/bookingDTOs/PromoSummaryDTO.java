package daviderocca.beautyroom.DTO.bookingDTOs;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Summary of one promotion frozen onto a booking (BookingPromotionLink snapshot).
 * Mirrors PackageSummaryDTO's role for the agenda card. Display-only; all monetary/
 * text fields are the snapshot, not the live promotion.
 *
 * promotionId is the live promo id for traceability/keying (per-line settle keys by it),
 * and is null when the promotion was deleted after attach — the frozen snapshot still
 * renders. promotionLinkId is the booking_promotion_link id (stable React key).
 */
public record PromoSummaryDTO(
        UUID promotionId,
        UUID promotionLinkId,
        String title,
        String discountType,          // snapshot string: PERCENTAGE/FIXED/PRICE_OVERRIDE/NONE
        BigDecimal discountValue,     // snapshot (nullable)
        BigDecimal totalOriginal,
        BigDecimal totalDiscounted,
        boolean paid,
        boolean appliedWhileActive,   // was the promo active when attached (badge)
        List<PromoLineSummaryDTO> services,
        List<PromoLineSummaryDTO> products
) {}
