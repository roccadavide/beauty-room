package daviderocca.CAPSTONE_BACKEND.DTO.reportDTOs;

import java.math.BigDecimal;

public record ServiceRevenueDTO(
        String serviceTitle,
        long bookingCount,
        BigDecimal revenue
) {}

