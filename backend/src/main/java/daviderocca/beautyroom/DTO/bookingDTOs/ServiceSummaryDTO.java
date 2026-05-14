package daviderocca.beautyroom.DTO.bookingDTOs;

import java.math.BigDecimal;
import java.util.UUID;

public record ServiceSummaryDTO(
        UUID id,
        String name,
        int durationMinutes,
        BigDecimal price,
        UUID optionId,
        String optionName,
        Integer overrideDurationMin,
        BigDecimal priceOverride
) {}
