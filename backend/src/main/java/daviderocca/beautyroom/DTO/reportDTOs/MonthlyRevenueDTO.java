package daviderocca.beautyroom.DTO.reportDTOs;

import java.math.BigDecimal;

public record MonthlyRevenueDTO(
        int year,
        int month,
        BigDecimal treatments,
        BigDecimal products,
        BigDecimal total
) {}

