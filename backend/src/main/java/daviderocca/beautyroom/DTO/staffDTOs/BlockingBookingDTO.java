package daviderocca.beautyroom.DTO.staffDTOs;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One future CONFIRMED booking that blocks a staff deactivation (decision #10).
 * Returned in the 409 body so the UI can list what needs reassigning.
 */
public record BlockingBookingDTO(
        UUID bookingId,
        LocalDateTime startTime,
        String customerName
) {}
