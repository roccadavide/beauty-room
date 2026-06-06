package daviderocca.beautyroom.DTO.bookingDTOs;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One frozen line of a promotion attached to a booking: a service or a product.
 * All values are the snapshot captured at attach time (08.1/08.2) — never read live.
 */
public record PromoLineSummaryDTO(
        UUID refId,                  // serviceId (service line) or productId (product line); null if source deleted
        String name,                 // frozen snapshot name
        BigDecimal originalPrice,    // frozen full price (struck-through in the UI)
        BigDecimal discountedPrice,  // frozen discounted price
        Integer durationMin          // service lines only; null for products
) {}
