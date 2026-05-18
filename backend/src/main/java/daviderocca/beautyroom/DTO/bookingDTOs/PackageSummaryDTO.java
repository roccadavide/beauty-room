package daviderocca.beautyroom.DTO.bookingDTOs;

import java.util.UUID;

public record PackageSummaryDTO(
        UUID packageAssignmentId,
        String packageName,
        int sessionsRemaining
) {}
