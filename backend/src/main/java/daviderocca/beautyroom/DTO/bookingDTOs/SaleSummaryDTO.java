package daviderocca.beautyroom.DTO.bookingDTOs;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One standalone product sale attached to a booking, surfaced on the agenda card
 * (BE-2 / scope A). Mirrors {@link PromoLineSummaryDTO}'s role for product lines.
 * Standalone only — promo product-lines stay inside {@link PromoSummaryDTO#products()}.
 */
public record SaleSummaryDTO(
        UUID saleId,
        UUID productId,
        String productName,
        int quantity,
        BigDecimal unitPrice,
        boolean paid
) {}
