package daviderocca.beautyroom.packages;

import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Request shape for one composition line of a client package.
 * At least one of {serviceId, serviceOptionId, customName} should be present;
 * validation is performed in the service layer to keep payloads forgiving.
 */
public record ClientPackageAssignmentItemRequestDTO(
        UUID serviceId,
        UUID serviceOptionId,
        @Size(max = 255) String customName,
        int position
) {}
