package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

public record ServiceRevenueDTO(
        String serviceTitle,
        long bookingCount,
        BigDecimal revenue
) {}

