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
        BigDecimal priceOverride,
        // V62: per-line settled flag (from booking_services.paid).
        boolean paid
) {}
