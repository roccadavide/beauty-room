package daviderocca.beautyroom.packages;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record RecurringPackageTemplateDTO(
        UUID id,
        String name,
        BigDecimal defaultPrice,
        Integer defaultDurationMin,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<RecurringPackageTemplateItemDTO> items
) {}
