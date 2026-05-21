package daviderocca.beautyroom.packages;

import java.util.UUID;

/**
 * Response shape for one composition line of a client package.
 * Composition items are descriptive — they do not carry per-item
 * session counters, prices, or durations.
 */
public record ClientPackageAssignmentItemDTO(
        UUID id,
        UUID serviceId,
        String serviceTitle,
        UUID serviceOptionId,
        String serviceOptionName,
        String customName,
        int position
) {}
