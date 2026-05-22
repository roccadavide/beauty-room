package daviderocca.beautyroom.DTO.bookingDTOs;

import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.PackageCreditStatus;

import java.math.BigDecimal;
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
        Integer optionDuration,
        BigDecimal optionPrice,
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
        Integer customServiceDurationMinutes,
        BigDecimal customServicePrice,
        Integer currentSession,
        Integer totalSessions,
        // Account linking
        UUID linkedUserId,
        String linkingStatus,
        // New package assignment system — deprecated singular kept for back-compat.
        // Equals linkedPackages.isEmpty() ? null : linkedPackages.get(0).
        @Deprecated
        PackageSummaryDTO linkedPackage,
        // Phase 5a: every in-person package link this booking participates in.
        // Empty when the booking is not linked to any in-person package.
        List<PackageSummaryDTO> linkedPackages,
        boolean paidInStore,
        // Payment / refund
        LocalDateTime paidAt,
        boolean paidOnline,
        boolean refundable,
        LocalDateTime reminderSentAt
) {}
