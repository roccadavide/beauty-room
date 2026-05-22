package daviderocca.beautyroom.DTO.closureDTOs;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Lightweight summary of bookings that overlap a (proposed or existing) closure
 * range. The list is intended for "⚠ N appuntamenti già prenotati" UI warnings;
 * it never auto-cancels and never blocks saving the closure.
 */
public record ClosureConflictPreviewDTO(
        int overlappingBookingsCount,
        List<ConflictBookingInfo> overlappingBookings
) {
    public record ConflictBookingInfo(
            UUID bookingId,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String customerName
    ) {}
}
