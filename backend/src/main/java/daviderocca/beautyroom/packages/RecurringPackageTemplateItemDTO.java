package daviderocca.beautyroom.packages;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Response shape for one composition line of a recurring package template.
 * serviceTitle / serviceOptionName may be null if the referenced catalog entry
 * was hard-deleted (FK ON DELETE SET NULL); the frontend falls back to
 * customName or a "Servizio rimosso" placeholder.
 */
public record RecurringPackageTemplateItemDTO(
        UUID id,
        UUID serviceId,
        String serviceTitle,
        UUID serviceOptionId,
        String serviceOptionName,
        String customName,
        int position,
        BigDecimal priceOverride,
        Integer durationOverrideMin
) {}
