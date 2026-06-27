package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

/**
 * One month of collected revenue, bucketed by COLLECTION date (cash-basis), split
 * by type. {@code totale = trattamenti + prodotti + pacchetti + promozioni} (net of
 * refunds, which subtract from trattamenti on their refund date).
 */
public record MonthlyRevenueDTO(
        int year,
        int month,
        BigDecimal trattamenti,
        BigDecimal prodotti,
        BigDecimal pacchetti,
        BigDecimal promozioni,
        BigDecimal totale
) {}
