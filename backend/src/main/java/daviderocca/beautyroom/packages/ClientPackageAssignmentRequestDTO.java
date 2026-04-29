package daviderocca.beautyroom.packages;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record ClientPackageAssignmentRequestDTO(

        @NotBlank @Size(max = 255)
        String clientName,

        UUID serviceOptionId,

        @Size(max = 255)
        String customPackageName,

        @Min(1)
        int totalSessions,

        @DecimalMin(value = "0.00")
        BigDecimal pricePaid,

        String notes,

        UUID linkedUserId
) {}
