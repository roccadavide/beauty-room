package daviderocca.beautyroom.packages;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ClientPackageAssignmentRequestDTO(

        @NotBlank @Size(max = 255)
        String clientName,

        // Legacy single-option fields. When items[] is provided, it is the
        // source of truth for composition; these are mapped to a single item
        // only when items is absent.
        UUID serviceOptionId,

        @Size(max = 255)
        String customPackageName,

        @Min(1)
        int totalSessions,

        // Optional: if provided, directly sets sessionsRemaining (admin correction use case)
        Integer sessionsRemaining,

        @DecimalMin(value = "0.00")
        BigDecimal pricePaid,

        String notes,

        UUID linkedUserId,

        // Multi-line composition. When non-null and non-empty, replaces any
        // legacy single-option mapping.
        @Valid
        List<ClientPackageAssignmentItemRequestDTO> items,

        // Optional override applied to every session of this package.
        Integer sessionDurationMin,

        // Whether the full package was paid upfront. Defaults to false when null.
        Boolean paidUpfront,

        // Starting session number for packages mid-course at launch. Defaults to 1 when null.
        Integer startSession
) {}
