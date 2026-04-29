package daviderocca.beautyroom.packages;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record LinkBookingRequestDTO(
        @NotNull UUID bookingId,
        @NotNull UUID assignmentId
) {}
