package daviderocca.beautyroom.DTO.bookingDTOs;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Per-service entry in a multi-service booking request.
 * Carries the service ID and, optionally, the chosen option ID.
 * Used in {@link AdminBookingCreateDTO#serviceEntries()} to replace the
 * flat {@code serviceIds} + single {@code serviceOptionId} pair.
 */
public record ServiceEntryDTO(
        UUID serviceId,
        UUID optionId,
        Integer overrideDurationMin,
        BigDecimal prezzoOverride
) {}
