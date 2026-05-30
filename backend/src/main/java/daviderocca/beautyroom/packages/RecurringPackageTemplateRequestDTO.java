package daviderocca.beautyroom.packages;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;
import java.util.List;

/**
 * Request shape for creating/updating a recurring package template.
 * items[] is the source of truth for composition and must be non-empty
 * (a template with zero lines is meaningless).
 */
public record RecurringPackageTemplateRequestDTO(

        @NotBlank
        String name,

        @DecimalMin(value = "0.00")
        BigDecimal defaultPrice,

        Integer defaultDurationMin,

        String notes,

        @Valid
        @NotEmpty
        List<RecurringPackageTemplateItemRequestDTO> items
) {}
