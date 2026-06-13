package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

public record PeriodSummaryDTO(
        BigDecimal totalRevenue,
        BigDecimal treatmentsRevenue,
        BigDecimal productsRevenue,
        BigDecimal packagesRevenue,
        long completedBookings,
        long cancelledBookings,
        long newClientsCount
) {}

