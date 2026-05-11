package daviderocca.beautyroom.DTO.bookingDTOs;

import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.PackageCreditStatus;

import java.time.LocalDateTime;
import java.util.List;
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
        Integer paddingMinutes,
        // Consenso PMU
        boolean consentRequired,
        boolean consentSigned,
        LocalDateTime consentSignedAt,
        // Multi-service / custom service / session tracking
        List<ServiceSummaryDTO> services,
        Boolean isCustomService,
        String customServiceName,
        Integer currentSession,
        Integer totalSessions,
        // Account linking
        UUID linkedUserId,
        String linkingStatus,
        // New package assignment system
        PackageSummaryDTO linkedPackage,
        boolean paidInStore
) {}
