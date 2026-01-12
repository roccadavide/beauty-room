package daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs;

import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminBookingCardDTO(
        UUID bookingId,
        LocalDateTime startTime,
        LocalDateTime endTime,
        BookingStatus status,
        String customerName,
        String customerPhone,
        String customerEmail,
        String serviceTitle,
        UUID serviceId,
        String optionName,
        UUID optionId,
        String notes
) {}