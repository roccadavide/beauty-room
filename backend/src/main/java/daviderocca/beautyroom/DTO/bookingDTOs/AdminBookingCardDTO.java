package daviderocca.beautyroom.DTO.bookingDTOs;

import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.PackageCreditStatus;

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
        String notes,
        UUID packageCreditId,
        Integer sessionsRemaining,
        Integer sessionsTotal,
        PackageCreditStatus packageStatus,
        String stripeSessionId,
        // Buffer minuti extra impostato dall'admin (puo' essere null).
        Integer paddingMinutes
) {}