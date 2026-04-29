package daviderocca.beautyroom.packages;

import java.time.LocalDateTime;
import java.util.UUID;

public record BookingPackageLinkDTO(
        UUID id,
        UUID bookingId,
        UUID assignmentId,
        String assignmentClientName,
        LocalDateTime linkedAt
) {}
