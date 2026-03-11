package daviderocca.CAPSTONE_BACKEND.DTO.reportDTOs;

import java.math.BigDecimal;

public record PeriodSummaryDTO(
        BigDecimal totalRevenue,
        BigDecimal treatmentsRevenue,
        BigDecimal productsRevenue,
        long completedBookings,
        long cancelledBookings,
        long newClientsCount
) {}

