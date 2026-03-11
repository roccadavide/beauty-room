package daviderocca.CAPSTONE_BACKEND.DTO.reportDTOs;

import java.time.LocalDateTime;

public record TopClientDTO(
        String customerName,
        String customerPhone,
        long totalBookings,
        long completedBookings,
        LocalDateTime lastBookingAt
) {}

