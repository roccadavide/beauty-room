package daviderocca.beautyroom.packages;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Request shape for one composition line of a recurring package template.
 * At least one of {serviceId, serviceOptionId, customName} should be present;
 * validation is performed in the service layer to keep payloads forgiving
 * (the DB CHECK constraint is the final guard).
 */
public record RecurringPackageTemplateItemRequestDTO(
        UUID serviceId,
        UUID serviceOptionId,
        @Size(max = 255) String customName,
        int position,
        @DecimalMin(value = "0.00") BigDecimal priceOverride,
        Integer durationOverrideMin
) {}
