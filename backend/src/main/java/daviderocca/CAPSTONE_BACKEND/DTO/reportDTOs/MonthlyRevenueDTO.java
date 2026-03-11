package daviderocca.CAPSTONE_BACKEND.DTO.reportDTOs;

import java.math.BigDecimal;

public record MonthlyRevenueDTO(
        int year,
        int month,
        BigDecimal treatments,
        BigDecimal products,
        BigDecimal total
) {}

